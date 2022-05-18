export function toMountTemplates() {
  const gridBody = document.createElement('div');
  gridBody.setAttribute('class', 'grid-stack');
  gridBody.style = 'width:100%;height:100%';
  document.body.appendChild(gridBody);

  const footer = document.createElement('div');
  footer.innerHTML = footerTemplate;
  footer.classList.add('workspace-footer');
  document.body.appendChild(footer);
}