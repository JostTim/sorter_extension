async function saveOptions(e) {

    e.preventDefault();

    let data = {
        API_KEY: document.getElementById("API_KEY").value,
        filter_grouped_tabs_from_prompt: document.getElementById("filter_grouped_tabs_from_prompt").checked,
        autorun_prompt_at_extension_opening: document.getElementById("autorun_prompt_at_extension_opening").checked
    }

    browser.runtime.sendMessage({ action: "saveStorageSync", data: data }).then(response => {
        setSubmitMessage(response.message);
        setTimeout(() => { setSubmitMessage(""); }, 3000);
    });
}

function setSubmitMessage(message) {
    document.getElementById('submitMessage').textContent = `${message}`;
}

async function get_browser_storage_key(key) {
    return (await browser.storage.sync.get(key))[key];
}

async function restoreOptions() {
    let API_KEY = await get_browser_storage_key("API_KEY");
    let filter_grouped_tabs_from_prompt = await get_browser_storage_key("filter_grouped_tabs_from_prompt");
    let autorun_prompt_at_extension_opening = await get_browser_storage_key("autorun_prompt_at_extension_opening");

    document.getElementById("API_KEY").value = API_KEY;
    document.getElementById("filter_grouped_tabs_from_prompt").checked = filter_grouped_tabs_from_prompt;
    document.getElementById("autorun_prompt_at_extension_opening").checked = autorun_prompt_at_extension_opening;

    const ai_prompts = document.getElementById('old_ai_prompts');

    

    console.log("AI prompts")
    console.log((await browser.storage.sync.get("filter*")))
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);