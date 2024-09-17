/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2023 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde

 ---

 Originally based on Rikaikun 0.8
 Copyright (C) 2010 Erek Speed
 http://code.google.com/p/rikaikun/

 ---

 Originally based on Rikaichan 1.07
 by Jonathan Zarate
 http://www.polarcloud.com/

 ---

 Originally based on RikaiXUL 0.4 by Todd Rudick
 http://www.rikai.com/
 http://rikaixul.mozdev.org/

 ---

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

 ---

 Please do not change or remove any of the copyrights or links to web pages
 when modifying any of the files.

 */

/* global globalThis */

'use strict';

import { ZhongwenDictionary } from './dict.js';
import './js/config.js';

let dict;

chrome.runtime.onInstalled.addListener(() => {

    chrome.contextMenus.create(
        {
            id: 'wordlistMenuItem',
            title: 'Mở Danh sách Từ vựng'
        }, () => {
            if (chrome.runtime.lastError) {
                // ignore
            }
        }
    );

    chrome.contextMenus.create(
        {
            id: 'helpMenuItem',
            title: 'Hiển thị Trợ giúp bằng tab mới'
        }, () => {
            if (chrome.runtime.lastError) {
                // ignore
            }
        }
    );
});

chrome.contextMenus.onClicked.addListener(wordlistMenuItemListener);

chrome.contextMenus.onClicked.addListener(helpMenuItemListener);

function wordlistMenuItemListener({menuItemId}) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (menuItemId === 'wordlistMenuItem') {
            let url = '/wordlist.html';
            let tabID = tabIDs['wordlist'];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (!chrome.runtime.lastError && tab && tab.url && (tab.url.endsWith('wordlist.html'))) {
                        chrome.tabs.update(tabID, {
                            active: true
                        });
                    } else {
                        chrome.tabs.create({
                            url: url
                        }, function (tab) {
                            tabIDs['wordlist'] = tab.id;
                            chrome.storage.session.set({tabIDs});
                        });
                    }
                });
            } else {
                chrome.tabs.create(
                    {url: url},
                    function (tab) {
                        tabIDs['wordlist'] = tab.id;
                        chrome.storage.session.set({tabIDs});
                    }
                );
            }
        }
    });
}

function helpMenuItemListener({menuItemId}) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (menuItemId === 'helpMenuItem') {
            let url = '/help.html';
            let tabID = tabIDs['help'];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (!chrome.runtime.lastError && tab && (tab.url.endsWith('help.html'))) {
                        chrome.tabs.update(tabID, {
                            active: true
                        });
                    } else {
                        chrome.tabs.create({
                            url: url
                        }, function (tab) {
                            tabIDs['help'] = tab.id;
                            chrome.storage.session.set({tabIDs});
                        });
                    }
                });
            } else {
                chrome.tabs.create(
                    {url: url},
                    function (tab) {
                        tabIDs['help'] = tab.id;
                        chrome.storage.session.set({tabIDs});
                    }
                );
            }
        }
    });
}

chrome.action.onClicked.addListener(activateExtensionToggle);

function activateExtensionToggle(currentTab) {
    chrome.storage.local.get('isActive', ({isActive}) => {
        isActive ? deactivateExtension() : activateExtension(currentTab.id);
    });
}

function activateExtension(tabId) {

    chrome.storage.local.set({isActive: true});

    enableTab(tabId);

    showActiveBadge();

    showHelpMenu(tabId);
}

function enableTab(tabId) {
    chrome.tabs.sendMessage(tabId, {
        'type': 'enable'
    }, () => {
        if (chrome.runtime.lastError) {
            // ignore
        }
    });
}

function showActiveBadge() {
    chrome.action.setBadgeBackgroundColor({
        'color': [255, 0, 0, 255]
    });

    chrome.action.setBadgeText({
        'text': 'On'
    });
}

function showHelpMenu(tabId) {
    chrome.tabs.sendMessage(tabId, {
        'type': 'showHelp'
    }, () => {
        if (chrome.runtime.lastError) {
            // ignore
        }
    });
}

function deactivateExtension() {

    chrome.storage.local.set({isActive: false});

    dict = undefined;

    showInactiveBadge();

    disableAllTabs();
}

function showInactiveBadge() {
    chrome.action.setBadgeBackgroundColor({
        'color': [0, 0, 0, 0]
    });

    chrome.action.setBadgeText({
        'text': ''
    });
}

function disableAllTabs() {
    chrome.windows.getAll(
        { 'populate': true },
        function (windows) {
            for (let i = 0; i < windows.length; ++i) {
                let tabs = windows[i].tabs;
                for (let j = 0; j < tabs.length; ++j) {
                    chrome.tabs.sendMessage(tabs[j].id, {
                        'type': 'disable'
                    }, () => {
                        if (chrome.runtime.lastError) {
                            // ignore
                        }
                    });
                }
            }
        }
    );
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    if (message.type === 'search') {

        search(message.text).then(response => {
            sendResponse(response);
        });

        return true;
    }
});

function search(text) {

    if (!dict) {
        return loadDictionary().then(d => {

            dict = d;

            return lookup(dict, text);

        });
    } else {
        let entry = lookup(dict, text);

        return Promise.resolve(entry);
    }
}

async function loadDictionary() {
    let [wordDict, wordIndex, grammarKeywords, vocabKeywords] = await loadDictData();
    return new ZhongwenDictionary(wordDict, wordIndex, grammarKeywords, vocabKeywords);
}

async function loadDictData() {
    let wordDict = fetch(chrome.runtime.getURL(
        "data/cedict_augmented.u8")).then(r => r.text());
    let wordIndex = fetch(chrome.runtime.getURL(
        "data/cedict_augmented.idx")).then(r => r.text());
    let grammarKeywords = fetch(chrome.runtime.getURL(
        "data/grammarKeywordsMin.json")).then(r => r.json());
    let vocabKeywords = fetch(chrome.runtime.getURL(
        "data/vocabularyKeywordsMin.json")).then(r => r.json());

    return Promise.all([wordDict, wordIndex, grammarKeywords, vocabKeywords]);
}

function lookup(dictionary, text) {

    let entry = dictionary.wordSearch(text);

    if (entry) {
        for (let i = 0; i < entry.data.length; i++) {
            let word = entry.data[i][1];
            if (dictionary.hasGrammarKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.grammar = { keyword: word, index: i };
            }
            if (dictionary.hasVocabKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.vocab = { keyword: word, index: i };
            }
        }
    }

    return entry;
}

chrome.tabs.onActivated.addListener(activeInfo => {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (activeInfo.tabId === tabIDs['wordlist']) {
            chrome.tabs.reload(activeInfo.tabId);
        } else if (activeInfo.tabId !== tabIDs['help']) {
            enableTabIfActive(activeInfo.tabId);
        }
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (changeInfo.status === 'complete' && tabId !== tabIDs['help'] && tabId !== tabIDs['wordlist']) {
            enableTabIfActive(tabId);
        }
    });
});


function enableTabIfActive(tabId) {

    chrome.storage.local.get('isActive', ({isActive}) => {
        if (isActive) {
            enableTab(tabId);
            showActiveBadge();
        }
    });
}

chrome.runtime.onMessage.addListener(function (message) {

    if (message.type === 'open') {
        chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
            let tabID = tabIDs[message.tabType];
            if (tabID) {
                chrome.tabs.get(tabID, () => {
                    if (!chrome.runtime.lastError) {
                        // activate existing tab
                        chrome.tabs.update(tabID, {active: true, url: message.url});
                    } else {
                        createTab(message.url, message.tabType);
                    }
                });
            } else {
                createTab(message.url, message.tabType);
            }
        });
    }
});

function createTab(url, tabType) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        chrome.tabs.create({url}, tab => {
            tabIDs[tabType] = tab.id;
            chrome.storage.session.set({tabIDs});
        });
    });
}

chrome.runtime.onMessage.addListener(function (message) {

    if (message.type === 'add') {
        chrome.storage.local.get(['wordList', 'saveToWordList'], data => {

            let wordList = data.wordList || [];

            let saveToWordList = data.saveToWordList || globalThis.defaultConfig.saveToWordList;

            for (let i in message.entries) {
                const entry = Object.assign({timestamp: Date.now()}, message.entries[i]);
                wordList.push(entry);

                if (saveToWordList === 'firstEntryOnly') {
                    break;
                }
            }

            chrome.storage.local.set({wordList});
        });

    } else if (message.type === 'speak') {
        chrome.storage.local.get(['lang'], data => {
            const lang = data.lang || globalThis.defaultConfig.lang;
            chrome.tts.speak(message.text, {lang, rate: 0.9});
        });
    }

});

