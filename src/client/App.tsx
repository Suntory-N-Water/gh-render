// src/App.tsx

import viteLogo from '/vite.svg';
import cloudflareLogo from './assets/Cloudflare_Logo.svg';
import honoLogo from './assets/hono.svg';
import reactLogo from './assets/react.svg';
import './App.css';

function App() {
  return (
    <>
      <div>
        <a href='https://vite.dev' target='_blank' rel='noopener'>
          <img src={viteLogo} className='logo' alt='Vite logo' />
        </a>
        <a href='https://react.dev' target='_blank' rel='noopener'>
          <img src={reactLogo} className='logo react' alt='React logo' />
        </a>
        <a href='https://hono.dev/' target='_blank' rel='noopener'>
          <img src={honoLogo} className='logo cloudflare' alt='Hono logo' />
        </a>
        <a
          href='https://workers.cloudflare.com/'
          target='_blank'
          rel='noopener'
        >
          <img
            src={cloudflareLogo}
            className='logo cloudflare'
            alt='Cloudflare logo'
          />
        </a>
      </div>
      <h1>Vite + React + Hono + Cloudflare</h1>
      <div className='card'>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <div className='card'>
        <p>
          Edit <code>worker/index.ts</code> to change the name
        </p>
      </div>
      <p className='read-the-docs'>Click on the logos to learn more</p>
    </>
  );
}

export default App;
