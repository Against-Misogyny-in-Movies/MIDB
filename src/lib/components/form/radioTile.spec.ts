import { render, screen } from '@testing-library/svelte';
import { faker } from '@faker-js/faker';
import RadioTile from './radioTile.svelte'
import { describe, expect, test } from 'vitest';
import type { ComponentProps } from 'svelte';

import '@testing-library/jest-dom';

type RadioTileProps = ComponentProps<RadioTile>

function createRadioTileProps(specific: Partial<RadioTileProps> = {}): RadioTileProps {
    return {
        name: faker.lorem.word(),
        value: faker.lorem.word(),
        title: faker.lorem.word(),
        short: faker.lorem.sentences(),
        ...specific
    }
}

describe("Component/RadioTile", () => {
    test("should render", () => {
        const props = createRadioTileProps({})
        render(RadioTile, props);
        const radioElement = document.querySelector("input");
        expect(radioElement).toBeInTheDocument();
    });

    test("should render title", () => {
        const props = createRadioTileProps({})
        render(RadioTile, props )
        expect(screen.getByText(props.title)).toBeInTheDocument()
    });

    test("should select radio by clicking the label", () => {
        const props = createRadioTileProps()
        render(RadioTile, props)
        const labelElement = document.querySelector("label");
        expect(labelElement).toBeInTheDocument()
        const radioElement = document.querySelector("input");
        labelElement!.click();
        expect(radioElement).toBeChecked()
    })

})