import '@testing-library/jest-dom/vitest';
import {afterEach,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
// JSDOM does not implement the browser APIs used by focusable popup controls.
if(!HTMLElement.prototype.scrollIntoView)HTMLElement.prototype.scrollIntoView=()=>{};
if(!HTMLElement.prototype.hasPointerCapture)HTMLElement.prototype.hasPointerCapture=()=>false;
if(!HTMLElement.prototype.releasePointerCapture)HTMLElement.prototype.releasePointerCapture=()=>{};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
