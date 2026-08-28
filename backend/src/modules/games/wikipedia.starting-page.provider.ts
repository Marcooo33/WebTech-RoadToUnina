import { WikipediaService } from "../wikipedia/wikipedia.service.js";
import type { StartingPage, StartingPageProvider } from "./starting-page.provider.js";

export class WikipediaStartingPageProvider implements StartingPageProvider {
  constructor(private readonly wikipedia: WikipediaService) {}

  async getStartingPage(): Promise<StartingPage> {
    const page = await this.wikipedia.getRandomStartingPage();
    return { pageId: page.pageId, title: page.title };
  }
}

export const wikipediaStartingPageProvider = new WikipediaStartingPageProvider(
  new WikipediaService(),
);
