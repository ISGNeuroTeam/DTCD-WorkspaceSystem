import './styles/TabsSwitcher.scss';
import TabsSwitcherHtml from './templates/TabsSwitcher.html';
import TabBtn from './TabBtn';

class TabsSwitcher {
  #htmlElement;
  #editMode;

  #tabBtnsList;
  #addTabBtn;
  #tabsContainer;
  #tabsCollection = new Map();

  constructor(options) {
    const {
      editMode = false,
    } = options instanceof Object ? options : {};

    this.#htmlElement = document.createElement('div');
    this.#htmlElement.classList.add('TabsSwitcher');
    this.#htmlElement.innerHTML = TabsSwitcherHtml;
    
    this.#addTabBtn = this.#htmlElement.querySelector('.AddBtn-js');
    this.#addTabBtn.addEventListener('click', this.#handleAddTabBtnClick);

    this.#tabBtnsList = this.#htmlElement.querySelector('.TabBtnsList-js');
    this.#tabsContainer = this.#htmlElement.querySelector('.TabItemsContainer-js');

    this.editMode = editMode;
  }

  get htmlElement() {
    return this.#htmlElement;
  }

  get editMode() {
    return this.#editMode;
  }

  set editMode (newValue) {
    this.#editMode = Boolean(newValue);

    for (let tab of this.#tabsCollection) {
      tab[1].tabBtn.setStatus('edit_on', this.#editMode);
    }

    this.#editMode
      ? this.htmlElement.classList.add('status_editOn')
      : this.htmlElement.classList.remove('status_editOn');
  }

  addNewTab(tabOptions) {
    const {
      id,
      name,
    } = tabOptions instanceof Object ? tabOptions : {};

    const tabId = id ? id : TabsSwitcher.getIdNewTab();

    const newTabItem = document.createElement('div');
    newTabItem.classList.add('TabItem');
    newTabItem.setAttribute('data-tab-id', tabId);
    this.#tabsContainer.appendChild(newTabItem);

    const newTabBtn = new TabBtn({
      name: this.#checkTabName(name) ? name : tabId,
    });
    newTabBtn.htmlElement.setAttribute('data-tab-id', tabId);
    this.#tabBtnsList.appendChild(newTabBtn.htmlElement);

    this.editMode && newTabBtn.setStatus('edit_on', this.editMode);

    newTabBtn.htmlElement.addEventListener('tab-delete', (event) => {
      event.stopPropagation();
      this.removeTab(tabId);
    });

    newTabBtn.htmlElement.addEventListener('tab-choose', (event) => {
      event.stopPropagation();
      this.activeTab(tabId);
    });

    this.#tabsCollection.set(tabId, {
      tabPanel: newTabItem,
      tabBtn: newTabBtn,
      isActive: false,
    });

    this.#htmlElement.dispatchEvent(new CustomEvent('tab-add', {
      bubbles: true,
      cancelable: false,
      detail: {
        tabId: tabId,
      },
    }));

    return tabId;
  }

  activeTab(tabId) {
    for (let tab of this.#tabsCollection) {
      if (tab[0] === tabId) {
        tab[1].isActive = true;
        tab[1].tabBtn.setStatus('active');
        tab[1].tabPanel.classList.add('status_active');
      } else {
        tab[1].isActive = false;
        tab[1].tabBtn.setStatus('active', false);
        tab[1].tabPanel.classList.remove('status_active');
      }
    }

    this.#htmlElement.dispatchEvent(new CustomEvent('tab-active', {
      bubbles: true,
      cancelable: true,
      detail: {
        tabId,
      }
    }));
  }

  removeTab(tabId) {
    if (!tabId) {
      return;
    }

    for (let tab of this.#tabsCollection) {
      if (tab[0] === tabId) {
        tab[1].tabBtn.htmlElement.remove();
        tab[1].tabPanel.remove();
      }
    }
    this.#tabsCollection.delete(tabId);
    
    this.#htmlElement.dispatchEvent(new CustomEvent('tab-delete', {
      bubbles: true,
      cancelable: false,
      detail: {
        tabId: tabId,
      },
    }));
  }

  getTab(tabId) {
    if (!tabId) {
      return;
    }

    return this.#tabsCollection.get(tabId);
  }

  getConfig () {
    const config = {
      editMode: this.editMode,
      tabsOptions: [],
    };
    
    for (let tab of this.#tabsCollection) {
      config.tabsOptions.push({
        id: tab[0],
        name: tab[1].tabBtn.name,
        isActive: tab[1].isActive,
      });
    }

    return config;
  }

  #handleAddTabBtnClick = (event) => {
    event.preventDefault();
    this.addNewTab();
  }

  #checkTabName (name) {
    // название не пустое.
    if (!name) return false;

    // проверка на повтор названия таба.
    this.#tabsCollection.forEach((tabItem) => {
      if (tabItem.tabBtn.name === name) return false;
    });

    return true;
  }

  static getIdNewTab() {
    return `wss-tab-${Math.ceil(Math.random() * 10000)}`;
  }
}

export default TabsSwitcher;