import './styles/TabsSwitcher.scss';
import TabsSwitcherHtml from './templates/TabsSwitcher.html';
import TabBtn from './TabBtn';

class TabsSwitcher {
  #htmlElement;
  #tabBtnsList;
  #addTabBtn;
  #tabsContainer;
  #tabsCollection = new Map();

  constructor(options) {
    const {
      editMode = false,
      tabsOptions = [],
    } = options;

    this.#htmlElement = document.createElement('div');
    this.#htmlElement.classList.add('TabsSwitcher');
    this.#htmlElement.innerHTML = TabsSwitcherHtml;
    
    this.#addTabBtn = this.#htmlElement.querySelector('.AddBtn-js');
    this.#addTabBtn.addEventListener('click', this.#handleAddTabBtnClick);

    this.#tabBtnsList = this.#htmlElement.querySelector('.TabBtnsList-js');
    this.#tabsContainer = this.#htmlElement.querySelector('.TabItemsContainer-js');

    for (let i = 0; i < tabsOptions.length; i++) {
      this.addNewTab(tabsOptions[i]);
      
      if (tabsOptions[i].isActive) {
        this.activeTab(tabsOptions[i].id);
      }
    }
  }

  get htmlElement() {
    return this.#htmlElement;
  }

  addNewTab(tabOptions) {
    const {
      id,
      name,
    } = tabOptions;

    const tabId = id ? id : TabsSwitcher.getIdNewTab();

    const newTabItem = document.createElement('div');
    newTabItem.classList.add('TabItem');
    newTabItem.setAttribute('data-tab-id', tabId);
    this.#tabsContainer.appendChild(newTabItem);

    const newTabBtn = new TabBtn({name});
    newTabBtn.htmlElement.setAttribute('data-tab-id', tabId);
    this.#tabBtnsList.appendChild(newTabBtn.htmlElement);

    newTabBtn.htmlElement.addEventListener('tab-delete', () => {
      this.removeTab(tabId);
    });

    newTabBtn.htmlElement.addEventListener('tab-choose', () => {
      this.activeTab(tabId);
    });

    this.#tabsCollection.set(tabId, {
      tabItem: newTabItem,
      tabBtn: newTabBtn,
    });

    if (this.#tabsCollection.size === 1) {
      this.activeTab(tabId);
    }

    return newTabItem;
  }

  activeTab(tabId) {
    for (let tab of this.#tabsCollection) {
      if (tab[0] === tabId) {
        tab[1].tabBtn.setStatus('active');
        tab[1].tabItem.classList.add('status_active');
      } else {
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