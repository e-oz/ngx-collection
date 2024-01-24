import { assertInInjectionContext, DestroyRef, inject, Injector, isDevMode, isSignal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { isObservable, Observable, of, retry, type RetryConfig, Subject, Subscription } from 'rxjs';

export type CreateEffectOptions = {
  injector?: Injector,
  /**
   * @param retryOnError
   * Set to 'false' to disable retrying on error.
   * Otherwise, generated effect will use `retry()`.
   * You can pass `RetryConfig` object here to configure `retry()` operator.
   */
  retryOnError?: boolean | RetryConfig,
};

/**
 * This code is copied from NgRx ComponentStore and edited to add `takeUntilDestroyed()` and to resubscribe on errors.
 * Credits: NgRx Team
 * https://ngrx.io/
 * Source: https://github.com/ngrx/platform/blob/main/modules/component-store/src/component-store.ts#L382
 * Docs:
 * https://ngrx.io/guide/component-store/effect#effect-method
 */
export function createEffect<
  ProvidedType = void,
  OriginType extends | Observable<ProvidedType> | unknown = Observable<ProvidedType>,
  ObservableType = OriginType extends Observable<infer A> ? A : never,
  ReturnType = ProvidedType | ObservableType extends void
    ? (
      observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>
    ) => Subscription
    : (
      observableOrValue: ObservableType | Observable<ObservableType> | Signal<ObservableType>
    ) => Subscription
>(generator: (origin$: OriginType) => Observable<unknown>, options?: CreateEffectOptions): ReturnType {

  if (!options?.injector && isDevMode()) {
    assertInInjectionContext(createEffect);
  }

  const injector = options?.injector ?? inject(Injector);
  const destroyRef = injector.get(DestroyRef);
  const origin$ = new Subject<ObservableType>();
  const retryOnError = options?.retryOnError ?? true;
  const retryConfig = (typeof options?.retryOnError === 'object' && options?.retryOnError) ? options?.retryOnError : {} as RetryConfig;

  if (retryOnError) {
    generator(origin$ as OriginType).pipe(
      retry(retryConfig),
      takeUntilDestroyed(destroyRef)
    ).subscribe();
  } else {
    generator(origin$ as OriginType).pipe(
      takeUntilDestroyed(destroyRef)
    ).subscribe();
  }

  return ((
    observableOrValue?: ObservableType | Observable<ObservableType> | Signal<ObservableType>
  ): Subscription => {
    const observable$ = isObservable(observableOrValue)
      ? observableOrValue
      : (isSignal(observableOrValue)
          ? toObservable(observableOrValue, { injector })
          : of(observableOrValue)
      );
    if (retryOnError) {
      return observable$.pipe(
        retry(retryConfig),
        takeUntilDestroyed(destroyRef)
      ).subscribe((value) => {
        origin$.next(value as ObservableType);
      });
    } else {
      return observable$.pipe(
        takeUntilDestroyed(destroyRef)
      ).subscribe((value) => {
        origin$.next(value as ObservableType);
      });
    }
  }) as unknown as ReturnType;
}
