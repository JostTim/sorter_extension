browser.runtime.onMessage.addListener(handle_request);

function handle_request(request, sender, sendResponse) {
    console.log(`New task ${request.action}`)
    if (request.action === 'order_tabs') {
        order_tabs(request.associations, request.options)
            .then(() => sendResponse({ result: 'success' }))
            .catch(error => sendResponse({ result: 'error', message: error.message }));
        return true;  // Indicates that the response will be sent asynchronously
    }

    if (request.action === 'get_browser_infos') {
        get_browser_infos()
            .then(browserInfos => sendResponse({ result: 'success', data: browserInfos }))
            .catch(error => sendResponse({ result: 'error', message: error.message }));
        return true;  // Indicates that the response will be sent asynchronously
    }

    if (request.action === 'get_associations') {
        get_associations(request.tabs, request.groups, request.options)
            .then(associationsInfos => sendResponse({ result: 'success', data: associationsInfos }))
            .catch(error => sendResponse({ result: 'error', message: error.message }));
        return true;  // Indicates that the response will be sent asynchronously
    }

    if (request.action === 'ensureStorageInitialization') {
        ensureStorageInitialization()
            .then(() => sendResponse({ result: "success", message: "Initialized Successfully" }))
            .catch(error => sendResponse({ result: 'error', message: error.message }))
        return true;
    }

    if (request.action === "saveStorageSync") {
        ensureStorageInitialization()
            .then(() => sendResponse({ result: "success", message: "Saved Successfully" }))
            .catch(error => sendResponse({ result: 'error', message: error.message }))
        return true;

    }

}

async function get_associations(tabs, groups, options) {
    let mapped_data = await mapTabsToGroups(tabs, groups, options);
    let associations = await prompt_ai_provider(mapped_data, options);
    let metadata = await get_associations_metadata(associations);
    return { associations: associations, metadata: metadata };
}

async function get_associations_metadata(associations) {

    let existing_groups_used = new Set();
    let new_groups_used = new Set();
    for (let tabId in associations) {

        if (!associations[tabId].g) { continue; }
        let matching_groups = await browser.tabGroups.query({ title: associations[tabId].g });
        if (matching_groups.length === 0) {
            new_groups_used.add(associations[tabId].g);
            continue;
        }
        existing_groups_used.add(matching_groups[0].title);
    }

    return { new_groups: new_groups_used, existing_groups_used: existing_groups_used };
}

async function mapTabsToGroups(tabs, groups, options) {
    // Prepare the data to send to the AI API
    let do_filter = (await browser.storage.sync.get('filter_grouped_tabs_from_prompt')).filter_grouped_tabs_from_prompt;

    if (do_filter) {
        tabs = tabs.filter(tab => tab.groupId === -1);
    }

    const data = {
        tabs: tabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            groupName: tab.groupId === -1 ? "" : (groups.find(group => group.id === tab.groupId) || {}).title
        })),
        groups: groups.map(group => ({ name: group.title })),
    };

    return data;
}

async function prompt_ai_provider(tabs_mapping, options) {

    const prompt = 'Please make associations of tabs to groups, leaving already existing group / tabs \
            associations, only making tabs with empty group association, linked to existing, \
            or new groups if you find that no exising group seem suitable. \
            Try reusing groups, and avoid creating too many new groups with similar thematics. \
            Please make your output a json compatible mapping of tab id to : groupname, and tab title. \
            Example : { "1565416846" : { "t" : "Youtube", "g" : "Divertissement" } } \
            Do not write otherwise any text (the output will be parsed by a program)';

    const input_body = JSON.stringify({
        model: "gpt-4.1",
        input: `${prompt}\ndata:${JSON.stringify(tabs_mapping)}`,
    });

    let api_key = (await browser.storage.sync.get('API_KEY')).API_KEY;
    console.log("API KEY", api_key)

    console.log(`Sending AI api fetch with ${input_body.length} characters`);

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${api_key}`
        },
        body: input_body
    });
    const result = await response.json();
    console.log(`Recieved AI api response of ${result.output[0].content[0].text.length} characters`);
    return JSON.parse(result.output[0].content[0].text);
}

async function get_browser_infos() {
    let tabs = await browser.tabs.query({});
    let groups = await browser.tabGroups.query({});

    let non_grouped_tabs = await browser.tabs.query({ groupId: -1 });

    // Promise.all([querying_tabs, querying_groups]).then(logTabsAndGroups).catch(onError);
    return { tabs: tabs, groups: groups, non_grouped_tabs: non_grouped_tabs };
}

async function order_tabs(new_associations, options) {
    for (let tabId in new_associations) {
        let tab = await browser.tabs.get(parseInt(tabId));
        // let tab = tabs.find(t => t.id == tabId);
        console.log("Selected tab with id ", tab.id);
        if (!tab) {
            console.error(`Tab with id ${tab.id} not found`);
            // the tab doesn't exist
            continue;
        }
        if (tab.groupId !== -1) {
            // a group is already associated with that tab
            console.log(`Tab with id ${tab.id} is already having a group : ${tab.groupId}`);
            continue;
        }

        let tab_association = new_associations[tabId];

        let tabTitle = tab_association.t;
        let groupName = tab_association.g;

        let matching_groups = await browser.tabGroups.query({ title: groupName })

        if (matching_groups.length === 1) {
            // Associate the tab to the group

            let group = matching_groups[0]

            if (tab.title !== tabTitle) {
                console.warn(`The title of the tab returned by the ai ${tabTitle} doesn't match the one returned by the browser.api ${tab.title}`)
                continue;
            }
            await browser.tabs.group({ tabIds: tab.id, groupId: group.id });
            console.log(`Moved the tab ${tab.id} to group ${group.id}`)
        }
        else if (matching_groups.length === 0) {
            // Group the tab into a new group, using all new tabs with that groups at once

            let sameGroupTabs = await find_all_tabs_for_group(new_associations, groupName)

            if (sameGroupTabs.length >= 2) {
                console.log("Would make ", sameGroupTabs.length, "tabs part of a new group", groupName);
                const groupId = await browser.tabs.group({ tabIds: sameGroupTabs });
                await browser.tabGroups.update(groupId, { title: groupName });
            }
            else {
                console.error("Group for ", groupName, "Is too small (less than 2)");
            }
        }
        else {
            console.error(`Cannot know what to do, several groups with the name ${groupName} exists`)
        }
    }
    return "success";
}

async function find_all_tabs_for_group(associations, groupName) {
    let sameGroupTabs = [];
    for (let id in associations) {
        if (associations[id].g === groupName) {
            let sameGroupTab = await browser.tabs.get(parseInt(id));
            if (sameGroupTab && sameGroupTab.groupId === -1) {
                sameGroupTabs.push(sameGroupTab.id);
            }
        }
    }
    return sameGroupTabs;
}

function onError(error) {
    console.log(`Error: ${error}`);
}

async function ensureStorageInitialization() {
    const existing_data = await browser.storage.sync.get();
    let updated_data = {}
    if (!"filter_grouped_tabs_from_prompt" in existing_data) {
        updated_data.filter_grouped_tabs_from_prompt = true;
    }
    if (!"autorun_prompt_at_extension_opening" in existing_data) {
        updated_data.autorun_prompt_at_extension_opening = false;
    }
    if (!"API_KEY" in existing_data) {
        updated_data.autorun_prompt_at_extension_opening = "";
    }
    if (!"ai_prompts_id" in existing_data) {
        updated_data.autorun_prompt_at_extension_opening = "";
    }


    await saveStorageSync(updated_data);
}

class Storage {

    static async save(data) {
        await browser.storage.sync.set(data);
    }

    static async get_value(key) {
        return (await browser.storage.sync.get(key))[key];
    }
}

class AIPrompts {
    static async setup() {

    }

    static async new_prompt(prompt) {
        let ai_prompts_ids = await Storage.get_prompts_id();
        let new_ai_prompt_id = ai_prompts_ids ? ai_prompts_ids[-1] + 1 : 0;

    }

    static async get_prompts_id() {
        return await Storage.get("ai_prompts_ids");
    }
}


















async function setup_ai_prompts() {

}

async function new_ai_prompt(prompt_content) {
    let ai_prompts_ids = await get_browser_storage_key("ai_prompts_ids");
    let new_ai_prompt_id = ai_prompts_ids ? ai_prompts_ids[-1] + 1 : 0;

}


async function get_ai_prompt(id) {
    return get_browser_storage_key(`ai_prompt_${id}`);
}

async function set_selected_ai_prompt(id, prompt) {
    let data = {};
    data[`ai_prompt_${id}`] = prompt;
    await get_browser_storage_key(data);
}

async function get_ai_id_uses(id) {
    return get_browser_storage_key(`ai_uses_${id}`);
}

async function add_ai_id_uses() {
    let ai_id = await get_selected_ai_prompt_id();

}

async function get_selected_ai_prompt_id() {
    return await get_browser_storage_key("selected_ai_prompt_id");
}

async function set_selected_ai_prompt_id(id) {
    await saveStorageSync({ selected_ai_prompt_id: id });
}

async function saveStorageSync(data) {
    await browser.storage.sync.set(data);
}

async function get_browser_storage_key(key) {
    return (await browser.storage.sync.get(key))[key];
}

