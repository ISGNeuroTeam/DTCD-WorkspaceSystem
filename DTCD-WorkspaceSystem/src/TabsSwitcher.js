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

    const newTabBtn = new TabBtn({name});
    newTabBtn.htmlElement.setAttribute('data-tab-id', tabId);
    this.#tabBtnsList.appendChild(newTabBtn.htmlElement);

    this.editMode && newTabBtn.setStatus('edit_on', this.editMode);

    newTabBtn.htmlElement.addEventListener('tab-delete', () => {
      this.removeTab(tabId);
    });

    newTabBtn.htmlElement.addEventListener('tab-choose', () => {
      this.activeTab(tabId);
    });

    this.#tabsCollection.set(tabId, {
      tabItem: newTabItem,
      tabBtn: newTabBtn,
      isActive: false,
    });

    if (this.#tabsCollection.size === 1) {
      this.activeTab(tabId);
    }

    return newTabItem;
  }

  activeTab(tabId) {
    for (let tab of this.#tabsCollection) {
      if (tab[0] === tabId) {
        tab[1].isActive = true;
        tab[1].tabBtn.setStatus('active');
        tab[1].tabItem.classList.add('status_active');
      } else {
        tab[1].isActive = false;
        tab[1].tabBtn.setStatus('active', false);
        tab[1].tabItem.classList.remove('status_active');
      }
    }
  }

  removeTab(tabId) {
    if (!tabId) {
      return;
    }

    for (let tab of this.#tabsCollection) {
      if (tab[0] === tabId) {
        tab[1].tabBtn.htmlElement.remove();
        tab[1].tabItem.remove();
      }
    }
    this.#tabsCollection.delete(tabId);
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

  #addNewTabBtn(tabBtnOptions) {
    const newTabBtn = new TabBtn(tabBtnOptions);
    this.#tabBtnsList.appendChild(newTabBtn.htmlElement);

    newTabBtn.htmlElement.addEventListener('tab-delete', () => {
      newTabBtn.htmlElement.remove();
    });

    newTabBtn.htmlElement.addEventListener('tab-choose', () => {
      newTabBtn.setStatus('active');
    });

    return newTabBtn;
  }

  #handleAddTabBtnClick = (event) => {
    event.preventDefault();
    this.addNewTab();
  }

  static getIdNewTab() {
    return `workspace-system-tab-${Math.ceil(Math.random() * 10000)}`;
  }
}

export default TabsSwitcher;