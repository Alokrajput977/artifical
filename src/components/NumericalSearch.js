import React, { useState, useEffect } from 'react';

const NumericalSearch = () => {
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState('');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = 'http://localhost:8000/api';

  useEffect(() => {
    fetchNumericalFields();
  }, []);

  const fetchNumericalFields = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge/stats`);
      if (response.ok) {
        const data = await response.json();
        setFields(data.numerical_fields || []);
      }
    } catch (err) {
      console.error('Error fetching fields:', err);
    }
  };

  const handleSearch = async () => {
    if (!selectedField || !minValue || !maxValue) {
      setError('Please fill all fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/search/numerical?field=${selectedField}&min_value=${parseFloat(minValue)}&max_value=${parseFloat(maxValue)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search numerical data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '12px',
      padding: '20px',
      margin: '20px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>🔢 Numerical Value Search</h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Search documents by numerical values (ratings, prices, levels, etc.)
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          style={{
            padding: '10px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            minWidth: '150px'
          }}
        >
          <option value="">Select numerical field</option>
          {fields.map(field => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Min value"
          value={minValue}
          onChange={(e) => setMinValue(e.target.value)}
          style={{
            padding: '10px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            width: '120px'
          }}
        />

        <input
          type="number"
          placeholder="Max value"
          value={maxValue}
          onChange={(e) => setMaxValue(e.target.value)}
          style={{
            padding: '10px',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            width: '120px'
          }}
        />

        <button 
          onClick={handleSearch} 
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            background: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#ff4444',
          color: 'white',
          padding: '10px',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-primary)' }}>Results ({results.length})</h4>
          {results.map((result, index) => (
            <div key={index} style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '15px',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {Object.entries(result.numerical_values || {}).map(([key, value]) => (
                  <span key={key} style={{
                    background: '#4a90e2',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {key}: {typeof value === 'number' ? value.toFixed(2) : value}
                  </span>
                ))}
              </div>
              <div style={{ color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: '10px' }}>
                <p style={{ margin: 0 }}>{result.text?.substring(0, 300)}...</p>
              </div>
              {result.metadata?.title && (
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  <strong>Title:</strong> {result.metadata.title}
                </div>
              )}
              {result.metadata?.category && (
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  <strong>Category:</strong> {result.metadata.category}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <p>No results found. Try a different search.</p>
        </div>
      )}
    </div>
  );
};

export default NumericalSearch;