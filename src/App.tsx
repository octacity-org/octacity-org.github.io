import { Component } from 'solid-js';
import { OctacityScene } from './components/OctacityScene';
import { GithubLink } from './components/GithubLink';

export const App: Component = () => {
  return (
    <>
      <OctacityScene />
      <main class="ui-overlay">
        <h1 class="brand-title">OCTACITY</h1>
        <GithubLink />
      </main>
    </>
  );
};
