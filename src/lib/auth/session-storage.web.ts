/** Web: só para desenvolvimento e testes visuais. Não é alvo de produção. */
export const sessionStorage = {
  async getItem(name: string) {
    return localStorage.getItem(`baiu:auth:${name}`);
  },
  async setItem(name: string, value: string) {
    localStorage.setItem(`baiu:auth:${name}`, value);
  },
  async removeItem(name: string) {
    localStorage.removeItem(`baiu:auth:${name}`);
  },
};
