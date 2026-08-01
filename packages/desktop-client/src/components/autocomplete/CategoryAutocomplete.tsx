import React, { Fragment, useMemo, useState } from 'react';
import type {
  ComponentProps,
  ComponentPropsWithoutRef,
  ComponentType,
  CSSProperties,
  ReactElement,
  ReactNode,
  SVGProps,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { SvgAdd, SvgSplit } from '@actual-app/components/icons/v0';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { getNormalisedString } from '@actual-app/core/shared/normalisation';
import { integerToCurrency } from '@actual-app/core/shared/util';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { css, cx } from '@emotion/css';

import {
  useCreateCategoryGroupMutation,
  useCreateCategoryMutation,
} from '#budget';
import { useEnvelopeSheetValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { makeAmountFullStyle } from '#components/budget/util';
import { FinancialText } from '#components/FinancialText';
import { useCategories } from '#hooks/useCategories';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { Autocomplete } from './Autocomplete';
import { filterCategorySuggestions } from './filterCategorySuggestions';
import { ItemHeader } from './ItemHeader';

type CategoryAutocompleteItem = Omit<CategoryEntity, 'group'> & {
  group?: CategoryGroupEntity;
};

// Sentinel id for the "Create category" row. It is never a real category id.
const CREATE_CATEGORY_ID = 'new';

// Inline-created categories have no group to belong to, so they all land in a
// single fallback group that is created on demand.
const FALLBACK_GROUP_NAME = 'Misc';

type CategoryListProps = {
  items: CategoryAutocompleteItem[];
  getItemProps?: (arg: {
    item: CategoryAutocompleteItem;
  }) => Partial<ComponentProps<typeof View>>;
  highlightedIndex: number;
  embedded?: boolean;
  footer?: ReactNode;
  inputValue?: string;
  createCategoryGroupName?: string;
  renderSplitTransactionButton?: (
    props: ComponentPropsWithoutRef<typeof SplitTransactionButton>,
  ) => ReactElement<typeof SplitTransactionButton>;
  renderCreateCategoryButton?: (
    props: ComponentPropsWithoutRef<typeof CreateCategoryButton>,
  ) => ReactNode;
  renderCategoryItemGroupHeader?: (
    props: ComponentPropsWithoutRef<typeof ItemHeader>,
  ) => ReactElement<typeof ItemHeader>;
  renderCategoryItem?: (
    props: ComponentPropsWithoutRef<typeof CategoryItem>,
  ) => ReactElement<typeof CategoryItem>;
  showHiddenItems?: boolean;
  showBalances?: boolean;
};
function CategoryList({
  items,
  getItemProps,
  highlightedIndex,
  embedded,
  footer,
  inputValue,
  createCategoryGroupName,
  renderSplitTransactionButton = defaultRenderSplitTransactionButton,
  renderCreateCategoryButton = defaultRenderCreateCategoryButton,
  renderCategoryItemGroupHeader = defaultRenderCategoryItemGroupHeader,
  renderCategoryItem = defaultRenderCategoryItem,
  showHiddenItems,
  showBalances,
}: CategoryListProps) {
  const { t } = useTranslation();
  const { splitTransaction, createCategory, groupedCategories } =
    useMemo(() => {
      return items.reduce(
        (acc, item, index) => {
          if (item.id === 'split') {
            acc.splitTransaction = { ...item, highlightedIndex: index };
            return acc;
          }

          if (item.id === CREATE_CATEGORY_ID) {
            acc.createCategory = { ...item, highlightedIndex: index };
            return acc;
          }

          const groupId = item.group?.id || '';
          const existing = acc.groupedCategories.find(
            x => x.group?.id === groupId,
          );
          const itemWithIndex = {
            ...item,
            highlightedIndex: index,
          };

          if (!existing) {
            acc.groupedCategories.push({
              group: item.group ?? null,
              categories: [itemWithIndex],
            });
          } else {
            existing.categories.push(itemWithIndex);
          }

          return acc;
        },
        {
          splitTransaction: null,
          createCategory: null,
          groupedCategories: [],
        } as {
          splitTransaction:
            | (CategoryAutocompleteItem & {
                highlightedIndex: number;
              })
            | null;
          createCategory:
            | (CategoryAutocompleteItem & {
                highlightedIndex: number;
              })
            | null;
          groupedCategories: Array<{
            group: CategoryGroupEntity | null;
            categories: Array<
              CategoryAutocompleteItem & { highlightedIndex: number }
            >;
          }>;
        },
      );
    }, [items]);

  return (
    <View>
      <View
        style={{
          overflowY: 'auto',
          willChange: 'transform',
          padding: '5px 0',
          ...(!embedded && { maxHeight: 175 }),
        }}
      >
        {splitTransaction &&
          (() => {
            const splitButtonProps = getItemProps
              ? getItemProps({ item: splitTransaction })
              : {};
            const { onClick, ...restSplitButtonProps } = splitButtonProps;
            return renderSplitTransactionButton({
              key: 'split',
              ...restSplitButtonProps,
              onClick,
              highlighted:
                splitTransaction.highlightedIndex === highlightedIndex,
              embedded,
            });
          })()}
        {createCategory &&
          renderCreateCategoryButton({
            ...(getItemProps ? getItemProps({ item: createCategory }) : {}),
            categoryName: inputValue ?? '',
            groupName: createCategoryGroupName ?? '',
            highlighted: createCategory.highlightedIndex === highlightedIndex,
            embedded,
          })}
        {groupedCategories.map(({ group, categories }) => {
          if (!group) {
            return null;
          }

          return (
            <Fragment key={group.id}>
              {renderCategoryItemGroupHeader({
                title: `${group.name}${group.hidden ? ` ${t('(hidden)')}` : ''}`,
                style: {
                  ...(showHiddenItems &&
                    group.hidden && { color: theme.pageTextSubdued }),
                },
              })}
              {categories.map(item => (
                <Fragment key={item.id}>
                  {renderCategoryItem({
                    ...(getItemProps ? getItemProps({ item }) : {}),
                    item,
                    highlighted: highlightedIndex === item.highlightedIndex,
                    embedded,
                    style: {
                      ...(showHiddenItems &&
                        (item.hidden || group.hidden) && {
                          color: theme.pageTextSubdued,
                        }),
                    },
                    showBalances,
                  })}
                </Fragment>
              ))}
            </Fragment>
          );
        })}
      </View>
      {footer}
    </View>
  );
}

type CategoryAutocompleteProps = ComponentProps<
  typeof Autocomplete<CategoryAutocompleteItem>
> & {
  categoryGroups?: Array<CategoryGroupEntity>;
  showBalances?: boolean;
  showSplitOption?: boolean;
  renderSplitTransactionButton?: (
    props: ComponentPropsWithoutRef<typeof SplitTransactionButton>,
  ) => ReactElement<typeof SplitTransactionButton>;
  renderCreateCategoryButton?: (
    props: ComponentPropsWithoutRef<typeof CreateCategoryButton>,
  ) => ReactNode;
  renderCategoryItemGroupHeader?: (
    props: ComponentPropsWithoutRef<typeof ItemHeader>,
  ) => ReactElement<typeof ItemHeader>;
  renderCategoryItem?: (
    props: ComponentPropsWithoutRef<typeof CategoryItem>,
  ) => ReactElement<typeof CategoryItem>;
  showHiddenCategories?: boolean;
  showCreateCategoryOption?: boolean;
};

export function CategoryAutocomplete({
  categoryGroups,
  showBalances = true,
  showSplitOption,
  embedded,
  closeOnBlur,
  renderSplitTransactionButton,
  renderCreateCategoryButton,
  renderCategoryItemGroupHeader,
  renderCategoryItem,
  showHiddenCategories,
  showCreateCategoryOption,
  inputProps,
  onSelect,
  onUpdate,
  ...props
}: CategoryAutocompleteProps) {
  const { t } = useTranslation();
  const { data: { grouped: defaultCategoryGroups } = { grouped: [] } } =
    useCategories();
  const createCategoryMutation = useCreateCategoryMutation();
  const createCategoryGroupMutation = useCreateCategoryGroupMutation();

  const [rawCategoryName, setRawCategoryName] = useState('');
  const hasCategoryInput = !!rawCategoryName;
  // Kept as a literal so the i18n parser can extract it.
  const fallbackGroupName = t('Misc');

  const categorySuggestions: CategoryAutocompleteItem[] = useMemo(() => {
    const allSuggestions = (categoryGroups || defaultCategoryGroups).reduce(
      (list, group) =>
        list.concat(
          (group.categories || [])
            .filter(category => category.group === group.id)
            .map(category => ({
              ...category,
              group,
            })),
        ),
      showSplitOption
        ? [{ id: 'split', name: '' } as CategoryAutocompleteItem]
        : [],
    );

    const visibleSuggestions = !showHiddenCategories
      ? allSuggestions.filter(
          suggestion =>
            suggestion.id === 'split' ||
            (!suggestion.hidden && !suggestion.group?.hidden),
        )
      : allSuggestions;

    if (!showCreateCategoryOption || !hasCategoryInput) {
      return visibleSuggestions;
    }

    return [
      { id: CREATE_CATEGORY_ID, name: '' } as CategoryAutocompleteItem,
      ...visibleSuggestions,
    ];
  }, [
    categoryGroups,
    defaultCategoryGroups,
    showSplitOption,
    showHiddenCategories,
    showCreateCategoryOption,
    hasCategoryInput,
  ]);

  function filterSuggestions(
    suggestions: CategoryAutocompleteItem[],
    value: string,
  ) {
    const createItem = suggestions.find(s => s.id === CREATE_CATEGORY_ID);
    const realSuggestions = suggestions.filter(
      s => s.id !== CREATE_CATEGORY_ID,
    );
    const filtered = filterCategorySuggestions(realSuggestions, value);

    if (!createItem || !value) {
      return filtered;
    }

    // Don't offer to create a category that already exists.
    const alreadyExists = realSuggestions.some(
      suggestion =>
        suggestion.id !== 'split' &&
        getNormalisedString(suggestion.name) === getNormalisedString(value),
    );
    if (alreadyExists) {
      return filtered;
    }

    // Keep the split option pinned to the top when it is shown.
    const splitItem = filtered.find(s => s.id === 'split');
    const rest = filtered.filter(s => s.id !== 'split');
    return splitItem ? [splitItem, createItem, ...rest] : [createItem, ...rest];
  }

  async function createCategoryInFallbackGroup(name: string) {
    const existingGroup = defaultCategoryGroups.find(
      group =>
        !group.is_income &&
        !group.hidden &&
        (getNormalisedString(group.name) ===
          getNormalisedString(fallbackGroupName) ||
          getNormalisedString(group.name) ===
            getNormalisedString(FALLBACK_GROUP_NAME)),
    );

    const groupId =
      existingGroup?.id ??
      (await createCategoryGroupMutation.mutateAsync({
        name: fallbackGroupName,
      }));

    return await createCategoryMutation.mutateAsync({
      name,
      groupId,
      isIncome: false,
      isHidden: false,
    });
  }

  // `onSelect` is a union of the single- and multi-select signatures, which
  // can't be called directly. Only the single-select variant ever sees the
  // create option, so the ids are forwarded through unchanged either way.
  type SelectedIds = string | null | NonNullable<string>[];
  const forwardSelect = onSelect as
    | ((ids: SelectedIds, value?: string) => void)
    | undefined;

  // `onUpdate` is declared as taking a category id, but the autocomplete
  // reports `null` whenever nothing resolves, which is what we forward when
  // the create option is highlighted.
  const forwardUpdate = onUpdate as
    | ((id: string | null, value: string) => void)
    | undefined;

  async function handleSelect(ids: SelectedIds, value?: string) {
    if (ids !== CREATE_CATEGORY_ID) {
      forwardSelect?.(ids, value);
      return;
    }

    const name = (value || rawCategoryName).trim();
    if (!name) {
      return;
    }

    const categoryId = await createCategoryInFallbackGroup(name);
    if (categoryId) {
      forwardSelect?.(categoryId, name);
    }
  }

  return (
    <Autocomplete
      strict
      highlightFirst
      embedded={embedded}
      closeOnBlur={closeOnBlur}
      itemToString={item => {
        if (!item) {
          return '';
        } else if (item.id === CREATE_CATEGORY_ID) {
          return rawCategoryName;
        }
        return item.name;
      }}
      inputProps={{
        ...inputProps,
        onChangeValue: (...args) => {
          setRawCategoryName(args[0]);
          inputProps?.onChangeValue?.(...args);
        },
        onBlur: e => {
          setRawCategoryName('');
          inputProps?.onBlur?.(e);
        },
      }}
      // Highlighting the "Create category" row must not stage `new` as a
      // value — it is only ever created by an explicit selection.
      onUpdate={(id, value) =>
        forwardUpdate?.(id === CREATE_CATEGORY_ID ? null : id, value)
      }
      onSelect={handleSelect}
      getHighlightedIndex={suggestions => {
        const firstCategoryIndex = suggestions.findIndex(
          suggestion =>
            suggestion.id !== 'split' && suggestion.id !== CREATE_CATEGORY_ID,
        );
        if (firstCategoryIndex !== -1) {
          return firstCategoryIndex;
        }

        // Nothing matched, so fall back to the create option when shown.
        const createIndex = suggestions.findIndex(
          suggestion => suggestion.id === CREATE_CATEGORY_ID,
        );
        return createIndex !== -1 ? createIndex : null;
      }}
      filterSuggestions={filterSuggestions}
      suggestions={categorySuggestions}
      renderItems={(items, getItemProps, highlightedIndex, inputValue) => (
        <CategoryList
          items={items}
          embedded={embedded}
          getItemProps={getItemProps}
          highlightedIndex={highlightedIndex}
          inputValue={inputValue}
          createCategoryGroupName={fallbackGroupName}
          renderSplitTransactionButton={renderSplitTransactionButton}
          renderCreateCategoryButton={renderCreateCategoryButton}
          renderCategoryItemGroupHeader={renderCategoryItemGroupHeader}
          renderCategoryItem={renderCategoryItem}
          showHiddenItems={showHiddenCategories}
          showBalances={showBalances}
        />
      )}
      {...props}
    />
  );
}

function defaultRenderCategoryItemGroupHeader(
  props: ComponentPropsWithoutRef<typeof ItemHeader>,
): ReactElement<typeof ItemHeader> {
  return <ItemHeader {...props} type="category" />;
}

type SplitTransactionButtonProps = ComponentPropsWithoutRef<typeof View> & {
  Icon?: ComponentType<SVGProps<SVGElement>>;
  highlighted?: boolean;
  embedded?: boolean;
  style?: CSSProperties;
};

function SplitTransactionButton({
  Icon,
  highlighted,
  embedded,
  style,
  ...props
}: SplitTransactionButtonProps) {
  return (
    <View
      // Downshift calls `setTimeout(..., 250)` in the `onMouseMove`
      // event handler they set on this element. When this code runs
      // in WebKit on touch-enabled devices, taps on this element end
      // up not triggering the `onClick` event (and therefore delaying
      // response to user input) until after the `setTimeout` callback
      // finishes executing. This is caused by content observation code
      // that implements various strategies to prevent the user from
      // accidentally clicking content that changed as a result of code
      // run in the `onMouseMove` event.
      //
      // Long story short, we don't want any delay here between the user
      // tapping and the resulting action being performed. It turns out
      // there's some "fast path" logic that can be triggered in various
      // ways to force WebKit to bail on the content observation process.
      // One of those ways is setting `role="button"` (or a number of
      // other aria roles) on the element, which is what we're doing here.
      //
      // ref:
      // * https://github.com/WebKit/WebKit/blob/447d90b0c52b2951a69df78f06bb5e6b10262f4b/LayoutTests/fast/events/touch/ios/content-observation/400ms-hover-intent.html
      // * https://github.com/WebKit/WebKit/blob/58956cf59ba01267644b5e8fe766efa7aa6f0c5c/Source/WebCore/page/ios/ContentChangeObserver.cpp
      // * https://github.com/WebKit/WebKit/blob/58956cf59ba01267644b5e8fe766efa7aa6f0c5c/Source/WebKit/WebProcess/WebPage/ios/WebPageIOS.mm#L783
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="button"
      style={{
        backgroundColor: highlighted
          ? theme.menuAutoCompleteBackgroundHover
          : 'transparent',
        borderRadius: embedded ? 4 : 0,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 500,
        color: theme.noticeTextMenu,
        padding: '6px 8px',
        ':active': {
          backgroundColor: 'rgba(100, 100, 100, .25)',
        },
        ...style,
      }}
      data-testid="split-transaction-button"
      {...props}
    >
      <Text style={{ lineHeight: 0 }}>
        {Icon ? (
          <Icon style={{ marginRight: 5 }} />
        ) : (
          <SvgSplit width={10} height={10} style={{ marginRight: 5 }} />
        )}
      </Text>
      <Trans>Split Transaction</Trans>
    </View>
  );
}

function defaultRenderSplitTransactionButton(
  props: SplitTransactionButtonProps,
): ReactElement<typeof SplitTransactionButton> {
  return <SplitTransactionButton {...props} />;
}

type CreateCategoryButtonProps = ComponentPropsWithoutRef<typeof View> & {
  Icon?: ComponentType<SVGProps<SVGElement>>;
  categoryName: string;
  groupName: string;
  highlighted?: boolean;
  embedded?: boolean;
  style?: CSSProperties;
};

export function CreateCategoryButton({
  Icon,
  categoryName,
  groupName,
  highlighted,
  embedded,
  style,
  ...props
}: CreateCategoryButtonProps) {
  const { isNarrowWidth } = useResponsive();
  const narrowStyle = isNarrowWidth ? { ...styles.mobileMenuItem } : {};
  const iconSize = isNarrowWidth ? 14 : 8;

  return (
    <View
      data-testid="create-category-button"
      style={{
        display: 'block',
        flex: '1 0',
        color: highlighted
          ? theme.menuAutoCompleteTextHover
          : theme.noticeTextMenu,
        borderRadius: embedded ? 4 : 0,
        fontSize: 11,
        fontWeight: 500,
        padding: '6px 9px',
        backgroundColor: highlighted
          ? theme.menuAutoCompleteBackgroundHover
          : 'transparent',
        ':active': {
          backgroundColor: 'rgba(100, 100, 100, .25)',
        },
        ...narrowStyle,
        ...style,
      }}
      {...props}
    >
      {Icon ? (
        <Icon style={{ marginRight: 5, display: 'inline-block' }} />
      ) : (
        <SvgAdd
          width={iconSize}
          height={iconSize}
          style={{ marginRight: 5, display: 'inline-block' }}
        />
      )}
      <Trans>
        Create category "{{ categoryName }}" in {{ groupName }}
      </Trans>
    </View>
  );
}

function defaultRenderCreateCategoryButton(
  props: ComponentPropsWithoutRef<typeof CreateCategoryButton>,
): ReactElement<typeof CreateCategoryButton> {
  return <CreateCategoryButton {...props} />;
}

type CategoryItemProps = {
  item: CategoryAutocompleteItem;
  className?: string;
  style?: CSSProperties;
  highlighted?: boolean;
  embedded?: boolean;
  showBalances?: boolean;
};

function CategoryItem({
  item,
  className,
  style,
  highlighted,
  embedded,
  showBalances,
  ...props
}: CategoryItemProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const narrowStyle = isNarrowWidth
    ? {
        ...styles.mobileMenuItem,
        borderRadius: 0,
        borderTop: `1px solid ${theme.pillBorder}`,
      }
    : {};
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const balanceBinding =
    budgetType === 'envelope'
      ? envelopeBudget.catBalance(item.id)
      : trackingBudget.catBalance(item.id);
  const balance = useSheetValue<
    'envelope-budget' | 'tracking-budget',
    typeof balanceBinding
  >(balanceBinding);

  const isToBudgetItem = item.id === 'to-budget';
  const toBudget = useEnvelopeSheetValue(envelopeBudget.toBudget);

  return (
    <button
      type="button"
      style={style}
      // See comment above.
      className={cx(
        className,
        css({
          backgroundColor: highlighted
            ? theme.menuAutoCompleteBackgroundHover
            : 'transparent',
          color: highlighted
            ? theme.menuAutoCompleteItemTextHover
            : theme.menuAutoCompleteItemText,
          padding: 4,
          paddingLeft: 20,
          borderRadius: embedded ? 4 : 0,
          border: 'none',
          font: 'inherit',
          ...narrowStyle,
        }),
      )}
      data-testid={`${item.name}-category-item`}
      data-highlighted={highlighted || undefined}
      {...props}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <TextOneLine>
          {item.name}
          {item.hidden || item.group?.hidden ? ' ' + t('(hidden)') : ''}
        </TextOneLine>
        <TextOneLine
          style={{
            display: !showBalances ? 'none' : undefined,
            marginLeft: 5,
            flexShrink: 0,
            ...makeAmountFullStyle((isToBudgetItem ? toBudget : balance) || 0, {
              positiveColor: theme.noticeTextMenu,
              negativeColor: theme.errorTextMenu,
            }),
          }}
        >
          {isToBudgetItem
            ? toBudget != null && (
                <>
                  {' '}
                  <FinancialText>
                    {integerToCurrency(toBudget || 0)}
                  </FinancialText>
                </>
              )
            : balance != null && (
                <>
                  {' '}
                  <FinancialText>
                    {integerToCurrency(balance || 0)}
                  </FinancialText>
                </>
              )}
        </TextOneLine>
      </View>
    </button>
  );
}

function defaultRenderCategoryItem(
  props: ComponentPropsWithoutRef<typeof CategoryItem>,
): ReactElement<typeof CategoryItem> {
  return <CategoryItem {...props} />;
}
