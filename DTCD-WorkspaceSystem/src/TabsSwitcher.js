import './styles/TabsSwitcher.scss';
import TabsSwitcherHtml from './templates/TabsSwitcher.html';
import TabBtn from './TabBtn';

class TabsSwitcher {
  #htmlElement;
  #tabsList;
  #addTabBtn;
  #tabsContainer;

  constructor(options) {
    this.#htmlElement = document.createElement('div');
    this.#htmlElement.classList.add('TabsSwitcher');
    this.#htmlElement.innerHTML = TabsSwitcherHtml;
    
    this.#addTabBtn = this.#htmlElement.querySelector('.AddBtn-js');
    this.#addTabBtn.addEventListener('click', this.#handleAddTabBtnClick);

    this.#tabsList = this.#htmlElement.querySelector('.TabsList-js');
    this.#tabsContainer = this.#htmlElement.querySelector('.TabItemsContainer-js');
  }

  get htmlElement() {
    return this.#htmlElement;
  }

  addNewTab(tabOptions) {
    const newTab = document.createElement('div');
    newTab.classList.add('TabItem');
    this.#tabsContainer.appendChild(newTab);
    this.#addNewTabBtn();

    return newTab;
  }

  #addNewTabBtn(tabBtnOptions) {
    const newTabBtn = new TabBtn(tabBtnOptions);
    this.#tabsList.appendChild(newTabBtn.htmlElement);

    newTabBtn.htmlElement.addEventListener('tab-delete', () => {
      newTabBtn.htmlElement.remove();
    });

    newTabBtn.htmlElement.addEventListener('tab-choose', () => {
      newTabBtn.setStatus('active');
    });
  }

  #handleAddTabBtnClick = (event) => {
    event.preventDefault();
    this.addNewTab();
  }
}

export default TabsSwitcher;