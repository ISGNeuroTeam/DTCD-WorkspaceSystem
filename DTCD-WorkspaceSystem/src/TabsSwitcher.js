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

    this.#tabsList = this.#htmlElement.querySelector('.TabsList-js');
    for (let i = 1; i <= 2; i++) {
      this.#addNewTabBtn();
    }

    this.#addTabBtn = this.#htmlElement.querySelector('.AddBtn-js');
    this.#addTabBtn.addEventListener('click', this.#handleAddTabBtnClick);
  }

  get htmlElement() {
    return this.#htmlElement;
  }

  #addNewTabBtn() {
    const newTabBtn = new TabBtn();
    this.#tabsList.appendChild(newTabBtn.htmlElement);

    newTabBtn.htmlElement.addEventListener('tab-delete', () => {
      newTabBtn.htmlElement.remove();
    });

    newTabBtn.htmlElement.addEventListener('click', () => {
      newTabBtn.setStatus('active');
    });
  }

  #handleAddTabBtnClick = (event) => {
    event.preventDefault();
    this.#addNewTabBtn();
  }
}

export default TabsSwitcher;