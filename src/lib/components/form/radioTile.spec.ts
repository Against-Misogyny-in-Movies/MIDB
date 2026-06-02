import { render, screen } from '@testing-library/svelte';
import { faker } from '@faker-js/faker';
import RadioTile from './radioTile.svelte'
import { describe, expect, test } from 'vitest';

import '@testing-library/jest-dom';

function createRadioTileProps() {
    return {
        name: faker.lorem.word(),
        value: faker.lorem.word(),
        title: faker.lorem.word(),
        short: faker.lorem.sentences(),
    }
}

describe("Component/RadioTile", () => {
    test("should render", () => {
        const props = createRadioTileProps()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render(RadioTile as any, props);
        const radioElement = document.querySelector("input");
        expect(radioElement).toBeInTheDocument();
    });

    test("should render title", () => {
        const props = createRadioTileProps()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render(RadioTile as any, props)
        expect(screen.getByText(props.title)).toBeInTheDocument()
    });

    test("should select radio by clicking the label", () => {
        const props = createRadioTileProps()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render(RadioTile as any, props)
        const labelElement = document.querySelector("label");
        expect(labelElement).toBeInTheDocument()
        const radioElement = document.querySelector("input");
        labelElement!.click();
        expect(radioElement).toBeChecked()
    })

})
