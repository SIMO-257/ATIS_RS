import React from "react";

const Form3Question = ({ id, text, options, value, onChange }) => {
  return (
    <div className="form3-question">
      <p className="form3-question-text">{text}</p>
      <div className="form3-options">
        {options.map((option, index) => {
          const inputId = `${id}-${index}`;
          return (
            <label key={inputId} className="form3-option" htmlFor={inputId}>
              <input
                id={inputId}
                type="radio"
                name={id}
                value={option}
                checked={value === option}
                onChange={(event) => onChange(id, event.target.value)}
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default Form3Question;
