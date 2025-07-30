console.log("Initializing Extension");

let browserInfos = {};
let associationsInfos = {};

const refresh_browser_infos_button = document.getElementById('getTabs')
const save_browser_infos_button = document.getElementById('saveTabs')
const refresh_associations_button = document.getElementById('getAssociations')
const save_associations_button = document.getElementById('saveAssociations')
const apply_auto_ordering_button = document.getElementById('orderFromAssociations')

const associations_list_divs = document.getElementById('associationsInfoList').querySelectorAll(".list-group-item");

async function getAutorun() {
    return (await browser.storage.sync.get('autorun_prompt_at_extension_opening')).autorun_prompt_at_extension_opening;
}

function updateButtons() {
    const tabsCount = browserInfos.tabs ? browserInfos.tabs.length : '-';
    const ungrouped_tabs = browserInfos.non_grouped_tabs ? browserInfos.non_grouped_tabs.length : "-";
    const existing_groups = browserInfos.groups ? browserInfos.groups.length : "-";

    const associationsCount = associationsInfos.associations ? Object.keys(associationsInfos.associations).length : "-";
    const existing_groups_used = associationsInfos.metadata ? associationsInfos.metadata.existing_groups_used.size : "-";
    const new_groups = associationsInfos.metadata ? associationsInfos.metadata.new_groups.size : "-";

    refresh_browser_infos_button.disabled = false;

    if (tabsCount === 0 || tabsCount === "-") {
        save_browser_infos_button.disabled = true;
        refresh_associations_button.disabled = true;
        save_associations_button.disabled = true;
        apply_auto_ordering_button.disabled = true;
    }
    else {
        console.log("associationsCount", associationsCount)
        console.log("tabsCount", tabsCount)
        if (ungrouped_tabs !== "-" && ungrouped_tabs > 0) {
            refresh_associations_button.disabled = false;
            save_browser_infos_button.disabled = false;
        }
        else {
            refresh_associations_button.disabled = true;
            save_browser_infos_button.disabled = true;
        }
        if (associationsCount === 0 || associationsCount === "-") {
            save_associations_button.disabled = true;
            apply_auto_ordering_button.disabled = true;
        }
        else {
            save_associations_button.disabled = false;
            apply_auto_ordering_button.disabled = false;
        }
    }

    document.getElementById('opened_tabs_text').textContent = `${tabsCount}`;
    document.getElementById('ungrouped_tabs_text').textContent = `${ungrouped_tabs}`;
    document.getElementById('existing_groups_text').textContent = `${existing_groups}`;

    document.getElementById('automatic_associations_text').textContent = `${associationsCount}`;
    document.getElementById('existing_groups_used_text').textContent = `${existing_groups_used}`;
    document.getElementById('new_groups_text').textContent = `${new_groups} `;
}

function resetAssociationsInfo() {
    associationsInfos = {};
};

function resetBrowserInfos() {
    browserInfos = {};
};

function disable_all_buttons() {
    refresh_browser_infos_button.disabled = true;
    save_browser_infos_button.disabled = true;
    refresh_associations_button.disabled = true;
    save_associations_button.disabled = true;
    apply_auto_ordering_button.disabled = true;
}

function getBrowserInfos() {
    resetBrowserInfos();
    resetAssociationsInfo();
    // Send a message to the background script
    disable_all_buttons();
    return browser.runtime.sendMessage({ action: "get_browser_infos" }).then(response => {
        browserInfos = response.data;
        updateButtons();
    });
}

function getAssociationsInfo() {

    const ungrouped_tabs = browserInfos.non_grouped_tabs ? browserInfos.non_grouped_tabs.length : 0;

    if (ungrouped_tabs === 0) {
        console.warn("Cannot get associations, the browserInfos data is empty or ungrouped tabs are 0")
        return;
    }
    resetAssociationsInfo();
    set_association_list_status(true);
    disable_all_buttons();
    // Send a message to the background script
    return browser.runtime.sendMessage({
        action: "get_associations",
        tabs: browserInfos.tabs,
        groups: browserInfos.groups
    }).then(response => {
        associationsInfos = response.data;
        set_association_list_status(false);
        updateButtons();
    });
}

function order_tabs() {
    disable_all_buttons();
    browser.runtime.sendMessage({ action: "order_tabs", associations: associationsInfos.associations }).then(response => {
        browserInfos = response.data;
        getBrowserInfos();
    });
}

function set_association_list_status(loading) {
    for (let element of associations_list_divs) {
        if (loading) { element.classList.add('loading'); }
        else { element.classList.remove('loading'); }
    }
}

function download_as_json(data, title) {
    console.log(data);

    json_data = JSON.stringify(data);

    const blob = new Blob([json_data], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = `${title}.json`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

document.getElementById('getTabs').addEventListener('click', getBrowserInfos);
document.getElementById('getAssociations').addEventListener('click', getAssociationsInfo);
document.getElementById('orderFromAssociations').addEventListener('click', order_tabs);

document.getElementById('saveTabs').addEventListener('click', () => {
    download_as_json(browserInfos, "input");
});

document.getElementById('saveAssociations').addEventListener('click', () => {
    download_as_json(associationsInfos, "output");
});


document.getElementById('extensionOptions').addEventListener('click', function () {
    browser.runtime.openOptionsPage();
});


updateButtons();

getAutorun().then(autorun => {
    console.log("autorun : ", autorun)
    if (autorun) {
        console.log("Auto running")
        getBrowserInfos().then(getAssociationsInfo);
    }
});


console.log("Extension Ready To Run");