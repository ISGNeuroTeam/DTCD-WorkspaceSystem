import './styles/TabsSwitcher.scss';
import TabsSwitcherHtml from './templates/TabsSwitcher.html';
import TabBtn from './TabBtn';

class TabsSwitcher {
  #htmlElement;
  #tabsList;
  #addTabBtn;

  constructor(options) {
    this.#htmlElement = document.createElement('div');
    this.#htmlElement.classList.add('TabsSwitcher');
    this.#htmlElement.innerHTML = TabsSwitcherHtml;
    
    this.#addTabBtn = this.#htmlElement.querySelector('.AddBtn-js');
    this.#addTabBtn.addEventListener('click', this.#handleAddTabBtnClick);

    this.#tabsList = this.#htmlElement.querySelector('.TabsList-js');
    this.addNewTabBtn();
  }

  get htmlElement() {
    return this.#htmlElement;
  }

  addNewTabBtn(tabBtnOptions) {
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
    this.addNewTabBtn();
  }
}

export default TabsSwitcher;