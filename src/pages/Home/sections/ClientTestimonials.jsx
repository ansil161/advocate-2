import SplitText from '../../../components/ui/SplitText.jsx';
import { testimonials } from '../../../data/testimonials.js';
import libraryImg from '../../../assets/img/library-moody.webp';

export default function ClientTestimonials() {
  const cards = testimonials.map((t, i) => (
    <div className="testi-card" key={i}>
      <div className="testi-card__stars">★★★★★</div>
      <p className="testi-card__quote">&ldquo;{t.quote}&rdquo;</p>
      <div className="testi-card__meta">{t.meta}</div>
    </div>
  ));

  return (
    <section className="testimonials" id="testimonials">
      <div className="testimonials__bg" aria-hidden="true"><img src={libraryImg} alt="" /></div>
      <div className="container">
        <span className="eyebrow eyebrow--light"><SplitText text="Client Experience" /></span>
        <h2 className="h2 h2--light">
          <SplitText text="What working with SLA" as="div" />
          <SplitText text="looks like." as="div" />
        </h2>
      </div>
      <div className="testimonials__track-wrap">
        <div className="testimonials__track">{cards}{cards}</div>
      </div>
    </section>
  );
}
