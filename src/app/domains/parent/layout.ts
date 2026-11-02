import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LanguageSwitcher } from '@/app/domains/admin/layout/ui/language-switcher';
import { SchemeSwitcher } from '@/app/domains/admin/layout/ui/scheme-switcher';
import { User } from '@/app/domains/admin/layout/ui/user';
import { NotificationBell } from '@/app/shared/components/notification-bell/notification-bell';

/** Parent portal shell: phone-first header with the notification bell. */
@Component({
  selector: 'parent-layout',
  imports: [RouterOutlet, RouterLink, LanguageSwitcher, SchemeSwitcher, User, NotificationBell],
  template: `
    <div class="flex min-h-screen w-full flex-col bg-neutral-50 dark:bg-neutral-900">
      <header class="flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm md:px-8 dark:border-neutral-700 dark:bg-neutral-800">
        <a class="flex items-center gap-x-3" routerLink="/parent">
          <img src="/images/logo/logo.svg" class="size-8" alt="" />
          <span class="text-lg font-bold">My children</span>
        </a>
        <div class="flex items-center gap-x-2">
          <language-switcher />
          <scheme-switcher />
          <notification-bell />
          <user />
        </div>
      </header>
      <main class="mx-auto w-full max-w-4xl flex-auto p-4 md:p-8">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ParentLayout {}
