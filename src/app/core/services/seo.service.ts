import { DOCUMENT } from '@angular/common';
import { inject, Injectable, REQUEST } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export type PageSeo = {
  title: string;
  description: string;
  /** Site path, e.g. "/t/t-huda". */
  path: string;
  /** Absolute or site-relative image for link previews (WhatsApp, X, Google). */
  image?: string | null;
  type?: 'website' | 'profile' | 'article';
};

/**
 * Title, description and link-preview tags of public pages. Rendered on the server, so search engines and
 * messaging apps read them without running the app.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);
  private request = inject(REQUEST, { optional: true });

  set(page: PageSeo): void {
    const origin = this.origin();
    const url = origin + page.path;
    const title = `${page.title} | أقلام`;
    const description = page.description.slice(0, 200);
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: page.type ?? 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'أقلام' });
    this.meta.updateTag({ property: 'og:locale', content: 'ar_SA' });
    this.meta.updateTag({ name: 'twitter:card', content: page.image ? 'summary' : 'summary' });
    if (page.image) {
      const image = page.image.startsWith('http') ? page.image : origin + page.image;
      this.meta.updateTag({ property: 'og:image', content: image });
    } else {
      this.meta.removeTag("property='og:image'");
    }
    this.canonical(url);
  }

  private canonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private origin(): string {
    if (this.request) return new URL(this.request.url).origin;
    return this.document.location?.origin ?? '';
  }
}
