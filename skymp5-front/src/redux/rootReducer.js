import { combineReducers } from 'redux';

import { animListReducer } from '../features/animList/reducer';
import { chatReducer } from '../features/chat/reducer';
import { appReducer } from '../reducers/app';
import { commandReducer } from '../reducers/command';

export const baseReducers = {
  commandReducer,
  appReducer,
  chatReducer,
  animListReducer,
};
export const rootReducer = combineReducers(baseReducers);
