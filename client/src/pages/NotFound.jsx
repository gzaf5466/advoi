import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{minHeight:'60vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center'}}>
      <h1 style={{fontSize:'3rem',marginBottom:'0.5rem'}}>404</h1>
      <p style={{opacity:0.8,marginBottom:'1.5rem'}}>Sorry, the page you are looking for does not exist.</p>
      <Link to="/" style={{color:'#2563eb',textDecoration:'underline'}}>Go back home</Link>
    </div>
  );
}
