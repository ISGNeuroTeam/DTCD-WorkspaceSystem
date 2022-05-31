import './styles/TabBtn.scss';
import TabBtnHtml from './templates/TabBtn.html';

const STATUS_EDIT_NAME = 'edit_name';
const STATUS_EDIT_ON = 'edit_on';
const STATUS_ACTIVE = 'active';

class TabBtn {
  #htmlElement;
  #name;
  #tabNameHtml;

  #inputFieldName;
  #btnEdit;
  #btnCheck;
  #btnDelete;
  #btnLayer;

  #callbackCheckTabName;
  
  constructor(options) {
    const {
      name = 'Без названия',
      callbackCheckTabName,
    } = options instanceof Object ? options : {};

    this.#htmlElement = document.createElement('div');
    this.#htmlElement.classList.add('TabBtn');
    this.#htmlElement.innerHTML = TabBtnHtml;

    this.#tabNameHtml = this.#htmlElement.querySelector('.TabName-js');
    this.#inputFieldName = this.#htmlElement.querySelector('.InputField-js');
    this.#inputFieldName.addEventListener('input', this.#handleNameFieldInput);

    this.name = name;
    this.#callbackCheckTabName = callbackCheckTabName;

    this.#btnEdit = this.#htmlElement.querySelector('.BtnIcon.type_edit-js');
    this.#btnCheck = this.#htmlElement.querySelector('.BtnIcon.type_check-js');
    this.#btnDelete = this.#htmlElement.querySelector('.BtnIcon.type_delete-js');
    this.#btnLayer = this.#htmlElement.querySelector('.BtnLayer-js');

    this.#btnEdit.addEventListener('click', this.#handleBtnEditClick);
    this.#btnCheck.addEventListener('click', this.#handleBtnCheckClick);
    this.#btnDelete.addEventListener('click', this.#handleBtnDeleteClick);
    this.#btnLayer.addEventListener('click', this.#handleBtnLayerClick);
  }

  get htmlElement() {
    return this.#htmlElement;
  }

  get name () {
    return this.#name;
  }

  set name (newValue) {
    this.#name = newValue;
    this.#tabNameHtml.textContent = newValue;
    this.#tabNameHtml.setAttribute('title', newValue);
  }

  setStatus(status, value = true) {
    switch (status) {
      case STATUS_EDIT_NAME:
        if (value) {
          this.#htmlElement.classList.add('status_editName');
          this.#inputFieldName.value = this.name;
        } else {
          this.#htmlElement.classList.remove('status_editName');
        }
        break;
        
      case STATUS_EDIT_ON:
        if (value) {
          this.#htmlElement.classList.add('status_editOn');
        } else {
          this.setStatus(STATUS_EDIT_NAME, false);
          this.#htmlElement.classList.remove('status_editOn');
        }
        break;

      case STATUS_ACTIVE:
        if (value) {
          this.#htmlElement.classList.add('status_active');
        } else {
          this.#htmlElement.classList.remove('status_active');
        }
        break;
    }
  }

  #handleBtnEditClick = (event) => {
    event.preventDefault();
    this.setStatus('edit_name');
  }

  #handleBtnCheckClick = (event) => {
    event.preventDefault();

    const {
      value,
      theme,
    } = this.#inputFieldName;

    if (theme.indexOf('withError') === -1) {
      this.name = value;
    }

    this.setStatus('edit_name', false);
  }

  #handleBtnDeleteClick = (event) => {
    event.preventDefault();
    this.#htmlElement.dispatchEvent(new CustomEvent('tab-delete', {
      bubbles: true,
      cancelable: true,
    }));
  }

  #handleBtnLayerClick = (event) => {
    event.preventDefault();
    this.#htmlElement.dispatchEvent(new CustomEvent('tab-choose', {
      bubbles: true,
      cancelable: true,
    }));
  }

  #handleNameFieldInput = (event) => {
    const newName = event.target.value;

    if (this.#callbackCheckTabName instanceof Function) {
      let inputThemes = this.#inputFieldName.theme;

      if (this.#callbackCheckTabName(this.name, newName)) {
        inputThemes = inputThemes.filter((theme) => theme !== 'withError');
      } else {
        inputThemes.indexOf('withError') === -1 && inputThemes.push('withError');
      }
      this.#inputFieldName.theme = inputThemes;
    } else {
    }
  }
}

export default TabBtn;