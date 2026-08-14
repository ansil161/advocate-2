import { useState } from 'react';

// The advocate as a portrait, not a paragraph.
//
// A wide black plate with the copy on the left and a cut-out portrait standing
// on the right — the head deliberately breaking the top edge and the shoulder
// the bottom one, so the figure occupies the page rather than sitting inside a
// frame. Behind them, the initials in serif at architectural scale.
//
// Portraits are expected to be background-free PNG/WebP (see public/team/
// README.md). When one is missing — or fails to load — the card falls back to
// the monogram composition, which is a design in its own right rather than a
// hole where a photo should be.
export default function CounselCard({ advocate, photoSide = 'right', className = '', children }) {
  const [photoOk, setPhotoOk] = useState(true);
  const showPhoto = Boolean(advocate.photo) && photoOk;

  return (
    <article
      className={`counsel counsel--${photoSide} ${showPhoto ? 'has-photo' : 'no-photo'} ${className}`}
    >
      {/* Everything decorative is clipped to the plate; only the portrait is
          allowed to overflow it. */}
      <div className="counsel__clip" aria-hidden="true">
        <span className="counsel__sheen" />
        <span className="counsel__mono">{advocate.initials}</span>
      </div>

      <span className="counsel__pin" aria-hidden="true" />

      <div className="counsel__body">
        <span className="counsel__exp">{advocate.exp}</span>
        <h3 className="counsel__name">{advocate.name}</h3>
        <p className="counsel__role">{advocate.role}</p>
        <p className="counsel__bio">{advocate.bio}</p>
        <div className="counsel__meta">
          <span>{advocate.qualification}</span>
          <span>{advocate.cases}</span>
        </div>
        {children}
      </div>

      <div className="counsel__portrait">
        {showPhoto && (
          <img
            src={advocate.photo}
            alt={`${advocate.name}, ${advocate.role}`}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoOk(false)}
          />
        )}
      </div>
    </article>
  );
}
