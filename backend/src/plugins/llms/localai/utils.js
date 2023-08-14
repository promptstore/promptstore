export const delay = (t) => {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  })
};
