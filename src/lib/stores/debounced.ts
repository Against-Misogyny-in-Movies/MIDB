import { Subject, distinctUntilChanged, debounceTime, switchMap, startWith } from 'rxjs';


type sourceFunction<T> = (test: string) => Promise<T>; 

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

