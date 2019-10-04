// @flow

import * as React from 'react';
import {AppState, YellowBox} from 'react-native';
import produce from 'immer';

import Main from './ui/Main';

//$FlowFixMe
YellowBox.ignoreWarnings([
  'Warning: componentWillMount has been renamed',
  'componentWillReceiveProps has been renamed',
  'Remote debugger is in a background tab which may cause apps to perform slowly.',
  '[RCTRootView cancelTouches]` is deprecated and wil',
]);

export type goal_t = {
  id: number,
  task: string,
};

type state_t = {
  goals: Array<goal_t>,
};

let count = 1;
const dummyData: Array<goal_t> = [
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
  {id: count, task: `Task id ${count++}`},
];

export default class App extends React.Component<{}, state_t> {
  state: state_t = {
    goals: dummyData,
  };

  goalAddHdlr = (task: string) => {
    const nextState = produce(this.state, (draftState: state_t) => {
      const uniqueEnoughId = Date.now();
      draftState.goals.push({id: uniqueEnoughId, task: task});
    });

    this.setState(nextState);
  };

  goalRmHdlr = (id: number) => {
    const nextState = produce(this.state, (draftState: state_t) => {
      const idxRm = draftState.goals.findIndex(element => element.id === id);
      if (idxRm === -1) {
        console.debug('goalRm, nable to find id to remove. Id was ', id);
        return draftState;
      }
      draftState.goals.splice(idxRm, 1);
    });

    this.setState(nextState);
  };

  goalMvHdlr = (idMoved: number, idMovedInFrontOf: number | null) => {
    const nextState = produce(this.state, (draftState: state_t) => {
      const idxIdMoved = draftState.goals.findIndex(
        (element: goal_t) => element.id === idMoved,
      );
      if (idxIdMoved === -1) {
        console.debug('goalMv, unable to find id to move. Id was ', idMoved);
        return draftState;
      }

      const rowMoved = draftState.goals[idxIdMoved];
      draftState.goals.splice(idxIdMoved, 1);

      if (idMovedInFrontOf === null) {
        draftState.goals.push(rowMoved);
      } else {
        const idxIdMovedInFrontOf = draftState.goals.findIndex(
          (element: goal_t) => element.id === idMovedInFrontOf,
        );
        if (idxIdMoved === -1) {
          console.debug(
            'goalMv, unable to find id to move in front of. Id was ',
            idMovedInFrontOf,
          );
          return draftState;
        }

        draftState.goals.splice(idxIdMovedInFrontOf, 0, rowMoved);
      }
    });

    this.setState(nextState);
  };

  render() {
    return (
      <Main
        goals={this.state.goals}
        addNewGoal={this.goalAddHdlr}
        rmGoal={this.goalRmHdlr}
        mvGoal={this.goalMvHdlr}
      />
    );
  }
}
