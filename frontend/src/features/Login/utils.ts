export const buildAuthorizeUrl = (
  authorizeUrl: string,
  appId: string,
  redirectUrl: string,
  state: string,
) => {
  const query = objectToQuery({
    response_type: 'code',
    app_id: appId,
    redirect_uri: redirectUrl,
    state,
  });
  return `${authorizeUrl}?${query}`;
};

export const buildTokenUrl = (
  tokenUrl: string,
  appId: string,
  code: string,
  redirectUrl: string,
) => {
  return `${tokenUrl}?app_id=${appId}&code=${code}`;
};

export const generateState = () => {
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let array = new Uint8Array(40) as any;
  window.crypto.getRandomValues(array);
  array = array.map((x: number) => validChars.codePointAt(x % validChars.length));
  const randomState = String.fromCharCode.apply(null, array);
  return randomState;
};

export const objectToQuery = (obj: Record<string, string>) => {
  const params = new URLSearchParams(obj);
  return String(params);
};

export const queryToObject = (query: string) => {
  const params = new URLSearchParams(query);
  return Object.fromEntries(params.entries());
};
