import { motion } from 'framer-motion';
import { manifesto } from '../../../data/firm.js';
import SplitText from '../../../components/ui/SplitText.jsx';

export default function Manifesto() {
  return (
    <section className="manifesto-editorial" id="manifesto">
      <div className="container">
        <div className="manifesto-editorial__grid">
          
          {/* Left Column: Sticky Eyebrow & Title */}
          <div className="manifesto-editorial__left">
            <span className="eyebrow eyebrow--light"><SplitText text={manifesto.eyebrow} /></span>
            <h2 className="manifesto-editorial__title">
              <SplitText text="Our" as="div" />
              <SplitText text="Convictions." as="i" />
            </h2>
          </div>
          
          {/* Right Column: Interactive Editorial Rows */}
          <div className="manifesto-editorial__right">
            {manifesto.lines.map((line, i) => (
              <motion.div 
                key={i} 
                className="manifesto-editorial__row"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 12 }}
              >
                <div className="manifesto-editorial__row-content">
                  <p className="manifesto-editorial__text">{line}</p>
                </div>
                {/* Visual hover indicator line */}
                <div className="manifesto-editorial__line-indicator" />
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
