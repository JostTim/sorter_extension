async function saveOptions(e) {
    e.preventDefault();
    await browser.storage.sync.set({
        API_KEY: document.querySelector("#API_KEY").value
    });
    await browser.storage.sync.set({
        filter_grouped_tabs_from_prompt: document.querySelector("#filter_grouped_tabs_from_prompt").checked
    });
    await browser.storage.sync.set({
        autorun_prompt_at_extension_opening: document.querySelector("#autorun_prompt_at_extension_opening").checked
    });
}

async function restoreOptions() {
    let API_KEY = (await browser.storage.sync.get('API_KEY')).API_KEY;
    let filter_grouped_tabs_from_prompt = (await browser.storage.sync.get('filter_grouped_tabs_from_prompt')).filter_grouped_tabs_from_prompt;
    let autorun_prompt_at_extension_opening = (await browser.storage.sync.get('autorun_prompt_at_extension_opening')).autorun_prompt_at_extension_opening;
    document.querySelector("#API_KEY").value = API_KEY || '';
    document.querySelector("#filter_grouped_tabs_from_prompt").checked = filter_grouped_tabs_from_prompt;
    document.querySelector("#autorun_prompt_at_extension_opening").checked = autorun_prompt_at_extension_opening;
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);