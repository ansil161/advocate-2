import Nav from './Nav.jsx';
import Footer from './Footer.jsx';
import AtmosphereField from './AtmosphereField.jsx';

export default function Layout({ children, navTheme = 'dark' }) {
  return (
    <>
      <AtmosphereField />
      <Nav theme={navTheme} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
