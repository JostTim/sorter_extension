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


    await browser.storage.sync.set({
        API_KEY: document.querySelector("#API_KEY").value
    });
    await browser.storage.sync.set({
        filter_grouped_tabs_from_prompt: document.querySelector("#filter_grouped_tabs_from_prompt").checked
    });
    await browser.storage.sync.set({
        autorun_prompt_at_extension_opening: document.querySelector("#autorun_prompt_at_extension_opening").checked
    });
    setSubmitMessage("Saved Successfully");
    setTimeout(() => { setSubmitMessage(""); }, 3000);
}

function setSubmitMessage(message) {
    document.getElementById('submitMessage').textContent = `${message}`;
}

async function restoreOptions() {
    let API_KEY = (await browser.storage.sync.get('API_KEY')).API_KEY;
    let filter_grouped_tabs_from_prompt = (await browser.storage.sync.get('filter_grouped_tabs_from_prompt')).filter_grouped_tabs_from_prompt;
    let autorun_prompt_at_extension_opening = (await browser.storage.sync.get('autorun_prompt_at_extension_opening')).autorun_prompt_at_extension_opening;
    document.querySelector("#API_KEY").value = API_KEY || '';
    document.querySelector("#filter_grouped_tabs_from_prompt").checked = filter_grouped_tabs_from_prompt;
    document.querySelector("#autorun_prompt_at_extension_opening").checked = autorun_prompt_at_extension_opening;

    const ai_prompts = document.getElementById('old_ai_prompts');

    console.log("AI prompts")
    console.log((await browser.storage.sync.get("filter*")))


}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);