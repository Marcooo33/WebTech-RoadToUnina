export interface StartingPage {
  pageId: number;
  title: string;
}

export interface StartingPageProvider {
  getStartingPage(): Promise<StartingPage>;
}

const PLACEHOLDER_STARTING_PAGE: StartingPage = {
  pageId: 1,
  title: "ROADTOUNINA placeholder start page",
};

export const placeholderStartingPageProvider: StartingPageProvider = {
  async getStartingPage(): Promise<StartingPage> {
    return PLACEHOLDER_STARTING_PAGE;
  },
};
