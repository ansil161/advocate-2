import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon, { practiceIcon } from '../../../components/ui/Icon.jsx';
import { chamberImage } from '../../PracticeAreas/lib/practiceImagery.js';

gsap.registerPlugin(ScrollTrigger);

export default function ExpertiseScroller({ items }) {
  const rootRef = useRef(null);
  
  // Show only 6 areas
  const displayedItems = items.slice(0, 6);
  // Split items into two columns for the parallax effect
  const leftCol = displayedItems.filter((_, i) => i % 2 === 0);
  const rightCol = displayedItems.filter((_, i) => i % 2 !== 0);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
        // Right column moves up faster than left column as you scroll down
        gsap.to('.t-bento__col--right', {
          yPercent: -15,
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
        
        gsap.to('.t-bento__col--left', {
          yPercent: -3,
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, [items]);

  const renderCard = (item, isTall) => {
    const imgUrl = chamberImage(item.slug).src;
    
    return (
      <Link 
        key={item.slug} 
        to={`/practice/${item.slug}`} 
        className={`t-bento-card ${isTall ? 't-bento-card--tall' : ''}`}
      >
        {/* Background Image */}
        <div className="t-bento-card__bg">
          <img src={imgUrl} alt={item.title} loading="lazy" />
          <div className="t-bento-card__wash"></div>
        </div>

        <div className="t-bento-card__inner">
          <div className="t-bento-card__top">
            <Icon name={practiceIcon(item.slug)} className="t-bento-card__icon" />
          </div>
          
          <div className="t-bento-card__bottom">
            <h3 className="t-bento-card__title">{item.title}</h3>
            
            <div className="t-bento-card__reveal">
              <p className="t-bento-card__desc">{item.short}</p>
              
              <div className="t-bento-card__foot">
                <ul className="t-bento-card__forums">
                  {item.forums.slice(0, 2).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <span className="t-bento-card__go">Explore →</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="t-bento" ref={rootRef}>
      <div className="container t-bento__grid">
        <div className="t-bento__col t-bento__col--left">
          {leftCol.map((item, i) => renderCard(item, i % 2 === 0))}
        </div>
        <div className="t-bento__col t-bento__col--right">
          {rightCol.map((item, i) => renderCard(item, i % 2 !== 0))}
        </div>
      </div>
      
      <div className="container t-bento__action">
        <Link to="/practice" className="btn btn--gold btn--outline">
          View All Practice Areas →
        </Link>
      </div>
    </div>
  );
}
