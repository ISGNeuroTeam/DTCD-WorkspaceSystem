export default function utf8_to_base64(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
      return String.fromCharCode('0x' + p1);
    })
  )
    .replaceAll('/', '_')
    .replaceAll('+', '-');
}
