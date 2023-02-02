import './styles/TabsSwitcher.scss';

/**
 * @class Class for managers tab panels and buttons.
 */
class TabsSwitcher {
  #htmlElement;

  #tabsContainer;

  #tabsCollection;

  /**
   * @constructs
   * @param {Object} [options] Parameters of tab switcher.
   * @param {Boolean} [options.tabsCollection] tab collection.
   */
  constructor(options) {
    const {
      tabsCollection
    } = options instanceof Object ? options : {};

    this.#tabsCollection = tabsCollection;

    this.#htmlElement = document.createElement('div');
    this.#htmlElement.classList.add('TabsSwitcher');
    this.#htmlElement.innerHTML = `<div class="TabItemsContainer TabItemsContainer-js"></div>`;

    this.#tabsContainer = this.#htmlElement.querySelector('.TabItemsContainer-js');

  }

  get htmlElement() {
    return this.#htmlElement;
  }

  get tabsCollection() {
    return this.#tabsCollection;
  }

  /**
   * Creating new tab panel.
   * @param {string} [tabId] ID of tab panel.
   * @param {Object} [collection] tab collection.
   */
  addNewTab(tabId, collection) {
    this.#tabsCollection = collection;

    const newTabItem = document.createElement('div');
          newTabItem.classList.add('TabItem');
          newTabItem.setAttribute('data-tab-id', tabId);
    this.#tabsContainer.appendChild(newTabItem);

    const element = this.#tabsCollection.find((tab) => tab.id === tabId);
          element.tabPanel = newTabItem;

    this.#htmlElement.dispatchEvent(new CustomEvent('tab-add', {
      bubbles: true,
      cancelable: false,
      detail: {
        tabId: tabId,
      },
    }));
  }

  activeTab(tabId) {
    this.#tabsCollection.forEach((tab) => {
      if (tab.id === tabId) {
        tab.tabPanel.classList.add('status_active');
      } else {
        tab.tabPanel.classList.remove('status_active');
      }
    });

    this.#htmlElement.dispatchEvent(new CustomEvent('tab-active', {
      bubbles: true,
      cancelable: true,
      detail: {
        tabId,
      }
    }));
  }

  removeTab(tabId) {
    this.#htmlElement.dispatchEvent(new CustomEvent('tab-delete', {
      bubbles: true,
      cancelable: false,
      detail: {
        tabId: tabId,
      },
    }));
  }

  clearTabItemsContainer() {
    this.#tabsContainer.innerHTML = '';
  }
}

export default TabsSwitcher;
