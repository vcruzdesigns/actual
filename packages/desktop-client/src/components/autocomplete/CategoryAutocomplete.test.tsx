import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { SpreadsheetProvider } from '#hooks/useSpreadsheet';
import { createTestQueryClient, TestProviders } from '#mocks';

import { CategoryAutocomplete } from './CategoryAutocomplete';

const categoryGroups: CategoryGroupEntity[] = [
  {
    id: 'bills-group',
    name: 'Bills',
    categories: [
      { id: 'rent-id', name: 'Rent', group: 'bills-group' },
      { id: 'electric-id', name: 'Electric', group: 'bills-group' },
    ],
  },
];

// Not good, see `Autocomplete.js` for details
function waitForAutocomplete() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('CategoryAutocomplete create option', () => {
  const queryClient = createTestQueryClient();

  function renderCategoryAutocomplete(props?: {
    showCreateCategoryOption?: boolean;
  }) {
    render(
      <TestProviders queryClient={queryClient}>
        <SpreadsheetProvider>
          <div data-testid="autocomplete-test">
            <CategoryAutocomplete
              categoryGroups={categoryGroups}
              showBalances={false}
              onSelect={vi.fn()}
              type="single"
              value={null}
              embedded={false}
              {...props}
            />
          </div>
        </SpreadsheetProvider>
      </TestProviders>,
    );
    return screen.getByTestId('autocomplete-test');
  }

  async function type(autocomplete: HTMLElement, text: string) {
    const input = autocomplete.querySelector('input')!;
    await userEvent.click(input);
    await userEvent.type(input, text);
    await waitForAutocomplete();
  }

  test('offers to create a category that does not exist yet', async () => {
    const autocomplete = renderCategoryAutocomplete({
      showCreateCategoryOption: true,
    });

    await type(autocomplete, 'Streaming');

    const createButton = screen.getByTestId('create-category-button');
    expect(createButton).toHaveTextContent('Create category "Streaming"');
    // The fallback group is named up front so it is clear where it lands.
    expect(createButton).toHaveTextContent('Misc');
  });

  test('does not offer to create a category that already exists', async () => {
    const autocomplete = renderCategoryAutocomplete({
      showCreateCategoryOption: true,
    });

    await type(autocomplete, 'Rent');

    expect(screen.queryByTestId('create-category-button')).toBeNull();
    expect(screen.getByTestId('Rent-category-item')).toBeInTheDocument();
  });

  test('matches existing categories case-insensitively', async () => {
    const autocomplete = renderCategoryAutocomplete({
      showCreateCategoryOption: true,
    });

    await type(autocomplete, 'rent');

    expect(screen.queryByTestId('create-category-button')).toBeNull();
  });

  test('still shows partial matches alongside the create option', async () => {
    const autocomplete = renderCategoryAutocomplete({
      showCreateCategoryOption: true,
    });

    await type(autocomplete, 'Rent Insurance');

    expect(screen.getByTestId('create-category-button')).toBeInTheDocument();
  });

  test('is not offered unless the option is enabled', async () => {
    const autocomplete = renderCategoryAutocomplete();

    await type(autocomplete, 'Streaming');

    expect(screen.queryByTestId('create-category-button')).toBeNull();
  });
});
