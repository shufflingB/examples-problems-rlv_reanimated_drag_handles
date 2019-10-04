//@flow
import * as React from 'react';
import {Animated, Dimensions, View} from 'react-native';
import {DataProvider, LayoutProvider, RecyclerListView} from 'recyclerlistview';

import {PanGestureHandler, State} from 'react-native-gesture-handler';
import type {ViewLayoutEvent} from 'react-native/Libraries/Components/View/ViewPropTypes';
import type {ScrollEvent} from 'react-native/Libraries/Types/CoreEventTypes';

function immutableMove(arr, from, to) {
  return arr.reduce((prev, current, idx, self) => {
    if (from === to) {
      prev.push(current);
    }
    if (idx === from) {
      return prev;
    }
    if (from < to) {
      prev.push(current);
    }
    if (idx === to) {
      prev.push(self[from]);
    }
    if (from > to) {
      prev.push(current);
    }
    return prev;
  }, []);
}

type RState = {
  rlvDataProvider: typeof DataProvider,
  isDraggingRow: boolean,
  rlvCurrentDraggingRowIdx: number,
  rlvAtStartDraggingRowIdx: number,
  containerAbsoluteYTopOffset: number,
  containerHeight: number,
};

export class SortableList<T> extends React.PureComponent<Props<T>, RState> {
  state: RState = {
    rlvDataProvider: new DataProvider((r1, r2) => {
      return r1 !== r2;
    }, this.props.indexToKey).cloneWithRows(this.props.data),
    isDraggingRow: false,
    rlvCurrentDraggingRowIdx: -1,
    rlvAtStartDraggingRowIdx: -1,
    containerAbsoluteYTopOffset: 0,
    containerHeight: 0,
  };

  _rlvRef = React.createRef<RecyclerListView<any, any>>();
  _rlvScrollOffset: number = 0;
  _rlvScrollingRequested: boolean = false;
  _rowAtStartAbsoluteY: number;
  _rlvLayoutProvider = new LayoutProvider(
    index => {
      return 1;
    },
    (type, dim) => {
      dim.width = Dimensions.get('window').width;
      dim.height = this.props.rowHeight;
    },
  );

  _dragTranslateY = new Animated.Value(0);
  _avRowAtDragStartY = new Animated.Value(0);

  _panGestureOnEventUpdate = Animated.event(
    [
      {
        nativeEvent: {
          translationY: this._dragTranslateY,
        },
      },
    ],
    {useNativeDriver: true},
  );

  componentWillUnmount() {
    this._dragTranslateY.removeAllListeners();
  }

  componentDidUpdate(prevProps: Props<T>) {
    if (prevProps.data !== this.props.data) {
      this.setState({
        rlvDataProvider: this.state.rlvDataProvider.cloneWithRows(
          this.props.data,
        ),
      });
    }
  }
  onLayoutStoreLayoutInfo = (e: ViewLayoutEvent) => {
    // console.debug(' Handling layout e = ', e.nativeEvent);
    this.setState({
      containerAbsoluteYTopOffset: e.nativeEvent.layout.y,
      containerHeight: e.nativeEvent.layout.height,
    });
  };

  _rlvOnScrollStoreOffsetInfo = (
    rawEvent: ScrollEvent,
    offsetX: number,
    offsetY: number,
  ) => {
    this._rlvScrollOffset = offsetY;
  };

  _rlvTriggerScroll = (scrollAmountY: number) => {
    if (this._rlvRef.current === null) {
      console.debug('moveList, no this.list.current, not doing anything');
      return;
    }
    if (this._rlvScrollingRequested) {
      return;
    }

    this._rlvScrollingRequested = true;
    this._rlvRef.current.scrollToOffset(
      0,
      this._rlvScrollOffset + scrollAmountY,
      false,
    );

    requestAnimationFrame(() => {
      this._rlvTriggerScroll(scrollAmountY);
      this._rlvScrollingRequested = false;
    });
  };

  _rlvGetIndexFromY = (absoluteY: number): number => {
    return Math.min(
      this.state.rlvDataProvider.getSize() - 1,
      Math.max(
        0,
        Math.floor(
          (absoluteY +
            this._rlvScrollOffset -
            this.state.containerAbsoluteYTopOffset) /
            this.props.rowHeight,
        ),
      ),
    );
  };

  _rlvRowRender = (type, data, index) => {
    //
    const dragHandleRender = () => {
      return (
        <PanGestureHandler
          minPointers={1}
          maxPointers={1}
          onGestureEvent={this._panGestureOnEventUpdate}
          onHandlerStateChange={this._panGestureOnStateChange}>
          <Animated.View>{this.props.renderDragHandle()}</Animated.View>
        </PanGestureHandler>
      );
    };

    // Render the row if it's not being dragged, else render a filler placeholder
    return this.props.renderRow(
      data,
      index,
      this.state.rlvCurrentDraggingRowIdx === index ? 'placeholder' : 'normal',
      dragHandleRender(),
    );
  };

  _panGestureOnStateChange = event => {
    switch (event.nativeEvent.state) {
      case State.BEGAN:
        // console.debug(
        //   '============== Gesture BEGAN =================================',
        // );

        this._rowAtStartAbsoluteY = event.nativeEvent.absoluteY;
        const rlvAtGestureStartIdx = this._rlvGetIndexFromY(
          event.nativeEvent.absoluteY,
        );

        // We need to tell the animated view where to start its translation from
        // so that it lines up with row underneath (bc the view is rendered over
        // the top)
        this._avRowAtDragStartY.setValue(
          rlvAtGestureStartIdx * this.props.rowHeight - this._rlvScrollOffset,
        );

        this.setState({
          isDraggingRow: true,
          rlvCurrentDraggingRowIdx: rlvAtGestureStartIdx,
          rlvAtStartDraggingRowIdx: rlvAtGestureStartIdx,
        });

        break;

      case State.ACTIVE:
        // console.debug(
        //   '==================== Gesture ACTIVE =================================',
        // );
        // console.debug('event === ', event.nativeEvent);
        this._dragTranslateY.addListener(({value}) =>
          this._panGestureRowMovingListener(value),
        );

        break;

      case State.CANCELLED:
      //  Intentional fall through
      case State.FAILED:
      //  Intentional fall through
      case State.UNDETERMINED:
      //  Intentional fall through
      case State.END:
        // console.debug(
        //   '==================== Gesture END =================================',
        // );
        // Stop any more panGestureUpdates or updates that might be in the queue
        this._dragTranslateY.removeAllListeners();
        this._rlvScrollingRequested = false;
        this.setState({isDraggingRow: false});

        // Take what we need to update our onSort callback
        const rlvAtStartOfGestureIdx = this.state.rlvAtStartDraggingRowIdx;
        const rlvAtEndOfGestureIdx = this.state.rlvCurrentDraggingRowIdx;
        const rlvCurrentData = this.state.rlvDataProvider.getAllData();

        // Reset state and internal properties
        this.setState({
          rlvCurrentDraggingRowIdx: -1,
          rlvAtStartDraggingRowIdx: -1,
        });

        // Trigger updating of external data iff necessary depending on if moving up or down in list
        if (rlvAtStartOfGestureIdx > rlvAtEndOfGestureIdx) {
          // Row moved up the list
          this.props.onSort(rlvAtStartOfGestureIdx, rlvAtEndOfGestureIdx);
        } else if (rlvAtStartOfGestureIdx < rlvAtEndOfGestureIdx) {
          // Row moved down in the list
          const lastIndex = rlvCurrentData.length - 1;
          rlvAtEndOfGestureIdx + 1 > lastIndex
            ? this.props.onSort(rlvAtStartOfGestureIdx, null)
            : this.props.onSort(
                rlvAtStartOfGestureIdx,
                rlvAtEndOfGestureIdx + 1,
              );
        }

        break;

      default:
        console.debug(
          'Unexpected nativeEvent.state, got ',
          event.nativeEvent.state,
        );
    }
  };

  _panGestureRowMovingListener = (dragTranslateY: number) => {
    // Discard anything that may be in the  queue after we've finished dragging
    if (this.state.isDraggingRow === false) {
      return;
    }

    const dragAbsoluteY = this._rowAtStartAbsoluteY + dragTranslateY;
    // console.debug(
    //   ' translateY = ',
    //   dragTranslateY,
    //   'absoluteY = ',
    //   dragAbsoluteY,
    // );

    /*
     * First up, have we dragged the row sufficiently towards the Bottom or Top of the screen that we should
     * trigger moving the data view port on RLV Up or Down on its data list
     */

    const minDragForScrollOnsetTranslationY = 5;
    const normalScrollOnsetZoneY = this.props.rowHeight * 1.25;
    const normalScrollAmount = 5;
    const fastScrollOnsetZoneY = this.props.rowHeight / 2;
    const fastScrollAmount = 40;

    const containerAbsoluteYBottomOffset =
      this.state.containerAbsoluteYTopOffset + this.state.containerHeight;

    if (dragTranslateY > minDragForScrollOnsetTranslationY) {
      // then dragging towards bottom of screen trigger scroll if we're in one of the zones
      dragAbsoluteY > containerAbsoluteYBottomOffset - fastScrollOnsetZoneY
        ? this._rlvTriggerScroll(fastScrollAmount)
        : dragAbsoluteY >
          containerAbsoluteYBottomOffset - normalScrollOnsetZoneY
        ? this._rlvTriggerScroll(normalScrollAmount)
        : 0;
    } else if (
      dragTranslateY < -minDragForScrollOnsetTranslationY &&
      this._rlvScrollOffset > 0
    ) {
      // then dragging upwards and there may be more that can be scrolled up if we are in one of the zones
      dragAbsoluteY <
      this.state.containerAbsoluteYTopOffset + fastScrollOnsetZoneY
        ? this._rlvTriggerScroll(-fastScrollAmount)
        : dragAbsoluteY <
          this.state.containerAbsoluteYTopOffset + normalScrollOnsetZoneY
        ? this._rlvTriggerScroll(-normalScrollAmount)
        : 0;
    }

    /*
     * Every time the dragged row moves over its immediate (above or below) neighbouring row update:
     * 1) The underlying data list order.
     * 2) Our references to what is being dragged in that list.
     */
    const draggedRowOverListIdx = this._rlvGetIndexFromY(dragAbsoluteY);

    if (draggedRowOverListIdx !== this.state.rlvCurrentDraggingRowIdx) {
      this.setState({
        rlvDataProvider: this.state.rlvDataProvider.cloneWithRows(
          immutableMove(
            this.state.rlvDataProvider.getAllData(),
            this.state.rlvCurrentDraggingRowIdx,
            draggedRowOverListIdx,
          ),
        ),
        rlvCurrentDraggingRowIdx: draggedRowOverListIdx,
      });
    }
  };

  render() {
    /*
     * Render the Animated View over the top of the RLV. Then, when:
     *
     * - Not dragging,
     *   a) the Animated View is rendered with nothing in it (the alternative
     *   of not rendering the Animated View doesn't work when useNative is
     *   enabled (as of RN 0.61.1) when rows are removed or items in the list are updated)
     *   b) RLV is instructed to render all rows as normal.
     *
     * - Dragging
     *   a) Animated View is rendered with a row styled as dragging.
     *   b) RLV renders the row that is being dragged up or down the list styled
     *   as a placeholder.
     *
     */

    return (
      <View style={{flex: 1}} onLayout={this.onLayoutStoreLayoutInfo}>
        <Animated.View
          style={{
            position: 'absolute',
            transform: [
              {
                translateY: Animated.add(
                  this._dragTranslateY,
                  this._avRowAtDragStartY,
                ),
              },
            ],
            zIndex: 200,
          }}>
          {this.state.isDraggingRow &&
            this.props.renderRow(
              this.props.data[this.state.rlvAtStartDraggingRowIdx], // NB: original data, as current rlv data will be updated
              this.state.rlvAtStartDraggingRowIdx,
              'dragging',
              this.props.renderDragHandle(), // No need wrap PanGestureHandler around as we actually drag what's in RLV and not this.
            ) // Or show nothing ....
          }
        </Animated.View>
        {this.props.data.length < 1 ? null : (
          <RecyclerListView
            ref={this._rlvRef}
            // style={{flex: 1, borderColor: 'red', borderWidth: 1}}
            onScroll={this._rlvOnScrollStoreOffsetInfo}
            layoutProvider={this._rlvLayoutProvider}
            dataProvider={this.state.rlvDataProvider}
            rowRenderer={this._rlvRowRender}
            extendedState={{dragging: true}}
          />
        )}
      </View>
    );
  }
}

type Props<T> = {
  rowHeight: number,
  data: Array<T>,
  indexToKey: (index: number) => string,
  renderRow: (
    dataItem: T,
    dataItemIndex: number,
    dataItemState: 'normal' | 'dragging' | 'placeholder',
    dataItemDragHandle: React.Node,
  ) => React.Node | null,
  renderDragHandle: () => React.Node,
  onSort: (movedIdx: number, inFrontOfIdx: number | null) => void,
};
