// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { getGroupPastChats } from '../../../group-chats.js';
import { getPastCharacterChats, animation_duration, animation_easing, getGeneratingApi } from '../../../../script.js';
//You'll likely need to import some other functions from the main script
import { saveSettingsDebounced } from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "st-chat-extractor";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

const {
    eventSource,
    event_types,
    getCurrentChatId,
    renameChat,
    getRequestHeaders,
    openGroupChat,
    openCharacterChat,
    executeSlashCommandsWithOptions,
    Popup,
} = SillyTavern.getContext();
 
// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

}

// This function is called when the button is clicked
async function onButtonClick() {
  // You can do whatever you want here
  // Let's make a popup appear with the checked setting
  //document.getElementById('option_select_chat')?.click();
  //await getChatFiles();
   const chatName = (document.getElementById('chat_select'));
   const selectedIndex = chatName.selectedIndex;

    if (selectedIndex === -1) {
        return null;
    }
    const context = SillyTavern.getContext();

    const selectedOption = chatName.options[selectedIndex];
    const selectedText = selectedOption.textContent;

    const body = {
            is_group: context.groupId != null,
            avatar_url: context.characters[context.characterId]?.avatar,
            file: `${selectedText}.jsonl`,
            exportfilename: `${selectedText}.jsonl`,
            format: `jsonl`,
     };
  
    try {
          const response = await fetch('/api/chats/export', {
              method: 'POST',
              body: JSON.stringify(body),
              headers: getRequestHeaders(),
          });
          
          const data = await response.json();
          const outputElement = document.getElementById('output');
          const textToShow = extractDetailsFromJsonlText(data.result, `mes`);
          
          if(textToShow != null) {
            const finalHtmlOutput = textToShow.join('');
            outputElement.innerHTML = finalHtmlOutput; 
          }
     } catch (error) {
          // display error message
          console.log(`An error has occurred: ${error.message}`);
          toastr.error(`Error: ${error.message}`);
     }

}
function extractDetailsContentFromHtmlString(htmlString) {
    const parser = new DOMParser();
    // 将 HTML 字符串解析为一个临时的 DOM 文档
    const doc = parser.parseFromString(htmlString, 'text/html');
    
    // 查找文档中所有的 <details> 元素
    const detailsElements = doc.querySelectorAll('details');
    const extractedContents = [];

    detailsElements.forEach(detailsElement => {
        let contentText = '';
        const summaryElement = detailsElement.firstElementChild;

        // 对应 Python 逻辑：检查元素是 <summary> 且其文本内容是 “摘要”
        if (summaryElement && summaryElement.tagName === 'SUMMARY' && summaryElement.textContent.trim() === '摘要') {
            
            // 对应 Python 中的 summary.decompose() 之后的逻辑：从下一个兄弟节点开始提取
            let currentNode = summaryElement.nextSibling;

            while (currentNode) {
                // 元素节点 (如 <div>, <p>)
                if (currentNode.nodeType === Node.ELEMENT_NODE) {
                    // 使用 outerHTML 对应 Python 的 detail.decode_contents()，保留其标签和内部结构
                    contentText += currentNode.outerHTML; 
                } 
                // 文本节点
                else if (currentNode.nodeType === Node.TEXT_NODE) {
                    contentText += currentNode.textContent;
                }
                
                currentNode = currentNode.nextSibling;
            }
        } 

        if (contentText.trim().length > 0) {
            extractedContents.push(contentText.trim() + '<br>');
        }
    });

    return extractedContents;
}
function extractDetailsFromJsonlText(jsonlText, targetKey) {
    if (typeof jsonlText !== 'string' || !targetKey) {
        console.error("输入参数无效。");
        return [];
    }
    
    const extractedContents = [];
    
    // 1. 模拟 Python 的文件读取和按行遍历
    // 使用可靠的分割方法：匹配所有换行符
    const lines = jsonlText.split(/\r\n|\n|\r/g).filter(Boolean);

    for (const line of lines) {
        let cleanLine = line.trim();
        if (!cleanLine) continue; 

        // 移除不可打印的控制字符
        cleanLine = cleanLine.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        try {
            // 2. 模拟 Python 的 json.loads(line)
            const data = JSON.parse(cleanLine);
            
            // 3. 检查目标键是否存在
            const htmlContent = data[targetKey];
            
            // 4. 检查内容是否为字符串且包含 <details>
            if (typeof htmlContent === 'string' && htmlContent.includes('<details>')) {
                // 5. 调用核心 HTML 解析函数
                const extracted = extractDetailsContentFromHtmlString(htmlContent);
                
                extractedContents.push(...extracted);
            }
        } catch (e) {
            // 模拟 Python 的 json.JSONDecodeError 异常处理
            console.warn(`警告：跳过无效的 JSON Lines 行，解析失败。错误: ${e.message}`);
            continue;
        }
    }
    
    return extractedContents;
}

async function onUpdateButtonClick() {
  setChatName(getCurrentChatId());
}

/**
 * Get list of chat names for a character.
 * @param {string} avatar Avatar name of the character
 * @returns {Promise<string[]>} List of chat names
 */
async function getListOfCharacterChats(avatar) {
    try {
        const result = await fetch('/api/characters/chats', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: avatar, simple: true }),
        });

        if (!result.ok) {
            return [];
        }

        const data = await result.json();
        return data.map(x => String(x.file_name).replace('.jsonl', ''));
    } catch (error) {
        console.error('Failed to get list of character chats', error);
        return [];
    }
}

function setChatName(name) {
    const chatName = (document.getElementById('chat_select'));
    const isNotInChat = !name;
    chatName.innerHTML = '';
    const selectedOption = document.createElement('option');
    selectedOption.innerText = name || `No chat selected`;
    selectedOption.selected = true;
    chatName.appendChild(selectedOption);
    chatName.disabled = true;
    if (!isNotInChat && typeof openGroupChat === 'function' && typeof openCharacterChat === 'function') {
        setTimeout(async () => {
            const list = [];
            const context = SillyTavern.getContext();
            if (context.groupId) {
                const group = context.groups.find(x => x.id == context.groupId);
                if (group) {
                    list.push(...group.chats);
                }
            }
            else {
                const characterAvatar = context.characters[context.characterId]?.avatar;
                list.push(...await getListOfCharacterChats(characterAvatar));
            }

            if (list.length > 0) {
                chatName.innerHTML = '';
                list.sort((a, b) => a.localeCompare(b)).forEach((x) => {
                    const option = document.createElement('option');
                    option.innerText = x;
                    option.value = x;
                    option.selected = x === name;

                    chatName.appendChild(option);
                });
                chatName.disabled = false;
            }
        }, 0);
    }
}

async function getChatFiles() {
    const context = SillyTavern.getContext();
    const chatId = getCurrentChatId();

    if (!chatId) {
        return [];
    }

    if (context.groupId) {
       toastr.info(
        "A popup appeared because you clicked the button!"
       );
        return await getGroupPastChats(context.groupId);
    }

    if (context.characterId !== undefined) {
        toastr.info(
        "B popup appeared because you clicked the button!"
       );
        return await getPastCharacterChats(context.characterId);
    }

    return [];
}

// This function is called when the extension is loaded
jQuery(async () => {
  // This is an example of loading HTML from a file
  const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);

  // Append settingsHtml to extensions_settings
  // extension_settings and extensions_settings2 are the left and right columns of the settings menu
  // Left should be extensions that deal with system functions and right should be visual/UI related 
  $("#extensions_settings").append(settingsHtml);

  // These are examples of listening for events
  $("#my_button").on("click", onButtonClick);
  $("#update_button").on("click", onUpdateButtonClick);
  // Load settings when starting things up (if you have any)
  loadSettings();
  //document.getElementById('chat_select').addEventListener('change', onChatNameChange);
  setChatName(getCurrentChatId());

});
