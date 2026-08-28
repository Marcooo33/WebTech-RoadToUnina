export interface StartingPage {
  pageId: number;
  title: string;
}

export interface StartingPageProvider {
  getStartingPage(): Promise<StartingPage>;
}
