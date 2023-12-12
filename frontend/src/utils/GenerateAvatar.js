const styles = [
  'adventurer',
  'adventurer-neutral',
  'avataaars',
  'avataaars-neutral',
  'big-ears',
  'big-ears-neutral',
  'big-smile',
  'bottts',
  'bottts-neutral',
  'croodles',
  'croodles-neutral',
  'fun-emoji',
  'icons',
  'identicon',
  'initials',
  'lorelei',
  'lorelei-neutral',
  'micah',
  'miniavs',
  'notionists',
  'notionists-neutral',
  'open-peeps',
  'personas',
  'pixel-art',
  'pixel-art-neutral',
  'rings',
  'shapes',
  'thumbs',
  'thumbs',
];

export const generateAvatar = (firstName, lastName) => {
  const data = [];
  const _styles = [...styles];
  for (let i = 0; i < 6; i++) {
    const index = Math.floor(Math.random() * _styles.length);
    const style = _styles[index];
    let seed;
    if (style === 'initials' && lastName) {
      seed = firstName.charAt(0) + lastName.charAt(0);
    } else {
      seed = firstName;
    }
    const res = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
    data.push(res);
    _styles.splice(index, 1);
  }
  return data;
};
