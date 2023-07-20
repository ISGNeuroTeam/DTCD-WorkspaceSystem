export default (body, name, version) => {
  body.style = `
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const content = document.createElement('div');
  content.style = `
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: var(--danger);
    font-size: 17px;
    padding: 20px;
    font-weight: 500;
  `;

  const icon = document.createElement('span');
  icon.style = `font-size: 50px; margin-bottom: 6px;`;
  icon.className = `FontIcon name_warningOutline Icon`;

  content.append(icon, `Плагин ${name} v${version} не найден`);
  body.append(content);
};
