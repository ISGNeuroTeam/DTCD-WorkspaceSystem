import './styles/TabsSwitcher.scss';
import TabsSwitcherHtml from './templates/TabsSwitcher.html';
import TabBtn from './TabBtn';

/**
 * @class Class for managers tab panels and buttons.
 */
class TabsSwitcher {
  #htmlElement;
  #editMode;
  #tabsCollection = new Map();
  #scrollBtnsInterval;

  #tabBtnsList;
  #tabBtnsListWrapper;
  #addTabBtn;
  #tabsContainer;
  #scrollBtnPrev;
  #scrollBtnNext;

  /**
   * @constructs
   * @param {Object} [options] Parameters of tab switcher.
   * @param {Boolean} [options.editMode=false] Toggle edit mode. 
   */
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

    this.#tabBtnsListWrapper = this.#htmlElement.querySelector('.TabBtnsListWrapper-js');
    this.#tabBtnsListWrapper.addEventListener('scroll', this.#handleTabBtnsListWrapperScroll);

    this.#scrollBtnPrev = this.#htmlElement.querySelector('.ScrollBtn.type_prev-js');
    this.#scrollBtnPrev.addEventListener('click', this.#handleScrollBtnClick);
    this.#scrollBtnNext = this.#htmlElement.querySelector('.ScrollBtn.type_next-js');
    this.#scrollBtnNext.addEventListener('click', this.#handleScrollBtnClick);

    this.#tabsContainer = this.#htmlElement.querySelector('.TabItemsContainer-js');

    this.editMode = editMode;

    this.#toggleVisibilityScrollBtns();
    this.#scrollBtnsInterval = setInterval(this.#toggleVisibilityScrollBtns, 200);
  }

  destructor() {
    clearInterval(this.#scrollBtnsInterval);
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

  /**
   * Creating new tab panel.
   * @param {Object} [tabOptions] Parameters of tab panel.
   * @param {string} [tabOptions.id] ID of tab panel.
   * @param {string} [tabOptions.name] Tab name. 
   * @returns {string} ID of new tab panel.
   */
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
      name: name ? name : tabId,
      callbackCheckTabName: this.#checkTabName,
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

  #checkTabName = (oldValue, newName) => {
    // название не пустое.
    if (!newName) return false;
    
    // проверка на повтор названия таба.
    let checkResult = true;
    this.#tabsCollection.forEach((tabItem) => {
      // условие, чтобы не проверять таб, название которого сейчас редактируется
      if (tabItem.tabBtn.name !== oldValue) {
        if(tabItem.tabBtn.name === newName) {
          checkResult = false;
          return;
        }
      }
    });

    return checkResult;
  }

  #toggleVisibilityScrollBtns = () => {
    const {
      scrollWidth,
      clientWidth,
    } = this.#tabBtnsListWrapper;

    if (scrollWidth > clientWidth) {
      this.#htmlElement.classList.add('withScroll');
    } else {
      this.#htmlElement.classList.remove('withScroll');
    }

    this.#handleTabBtnsListWrapperScroll();
  }

  #handleTabBtnsListWrapperScroll = () => {
    const {
      scrollLeft,
      scrollWidth,
      clientWidth,
    } = this.#tabBtnsListWrapper;

    if (scrollLeft === 0) {
      this.#scrollBtnPrev.setAttribute('disabled', 'disabled');
    } else {
      this.#scrollBtnPrev.removeAttribute('disabled');
    }

    if (scrollLeft + clientWidth === scrollWidth) {
      this.#scrollBtnNext.setAttribute('disabled', 'disabled');
    } else {
      this.#scrollBtnNext.removeAttribute('disabled');
    }
  }

  #handleScrollBtnClick = (event) => {
    event.preventDefault();

    const isBtnNext = event.currentTarget.classList.contains('type_next-js');
    const {
      clientWidth,
    } = this.#tabBtnsListWrapper;

    this.#tabBtnsListWrapper.scrollLeft += isBtnNext ? (clientWidth * 0.8) : -(clientWidth * 0.8);
  }

  static getIdNewTab() {
    return `wss-tab-${Math.ceil(Math.random() * 10000)}`;
  }
}

export default TabsSwitcher;