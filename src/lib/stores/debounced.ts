import { Subject, distinctUntilChanged, debounceTime, switchMap, startWith } from 'rxjs';


type sourceFunction<T> = (test: string) => Promise<T>; 

/**
 * Creates a debounced search store backed by an RxJS pipeline.
 * Calling `.search(query)` schedules a debounced call to `source(query)`;
 * subscribers receive the resolved value once the debounce settles.
 * Consecutive identical queries are skipped (`distinctUntilChanged`).
 *
 * @param source - Async function that takes a query string and returns a result.
 * @param time - Debounce delay in milliseconds (default: 500).
 * @returns An object with `search(input)` to trigger a query and `subscribe` to observe results.
 */
export function createDebouncedSearchStore<T>(source: sourceFunction<T>, time = 500 ) {

    const search$ = new Subject<string>();
    const _items$ = search$.pipe(
        debounceTime(time),
        distinctUntilChanged(),
        switchMap<string, Promise<T>>(query => source(query)),
        startWith([])
    );

    return  {
        search: (input: string) => search$.next(input), 
        subscribe: _items$.subscribe.bind(_items$)
    }

}

