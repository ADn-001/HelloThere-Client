import React from 'react';
import PropTypes from 'prop-types';

// Group chat UI component
const Chat = ({ messages, inputText, setInputText, handleSendMessage, peerId }) => {
  console.log('[Chat] Rendering with messages:', messages);

  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="chat-container">
      <style>
        {`
          .chat-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
            flex-grow: 1;
            width: 100%;
          }

          .chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            padding: 8px;
            margin-bottom: 64px;
          }

          .message-container {
            display: flex;
            flex-direction: column;
            margin: 4px 0;
          }

          .message-container-self {
            align-items: flex-end;
            margin-bottom: 2px;
          }

          .message-container-other {
            align-items: flex-start;
            margin-bottom: 2px;
          }

          .message {
            max-width: 70%;
            padding: 8px 12px;
            border-radius: 12px;
            font-size: 16px;
            color: #FFFFFF;
          }

          .message-self {
            background-color: #10B981;
            margin-left: calc(2% + 8px);
            margin-right: 1px;
            margin-bottom: 2px;
            padding-left: calc(10% + 8px);
          }

          .message-other {
            background-color: #343541;
            margin-right: calc(2% + 8px);
            margin-left: 1px;
            margin-bottom: 2px;
            padding-right: calc(25% + 8px);
          }

          .message-sender-self {
            text-align: right;
            color: #D1D5DB;
            font-size: 12px;
            font-weight: 600;
            margin-right: 5px;
            margin-bottom: 3px;
          }

          .message-sender-other {
            text-align: left;
            color: #D1D5DB;
            font-size: 12px;
            font-weight: 600;
            margin-left: 5px;
            margin-bottom: 3px;
          }

          .chat-input-container {
            position: fixed;
            bottom: 16px;
            width: calc(95% - 16px);
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 8px;
          }

          .chat-input {
            flex: 1;
            background-color: #343541;
            color: #FFFFFF;
            border: 1px solid #4B5563;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 16px;
            outline: none;
          }

          .chat-input::placeholder {
            color: #6B7280;
          }

          .send-button {
            background-color: #10B981;
            color: #FFFFFF;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .send-button:hover {
            background-color: #059669;
          }
        `}
      </style>
      <div className="chat-messages">
        {safeMessages.map((msg) => (
          <div
            key={msg.id}
            className={`message-container ${msg.sender === peerId ? 'message-container-self' : 'message-container-other'}`}
          >
            <div className={msg.sender === peerId ? 'message-sender-self' : 'message-sender-other'}>
              {msg.sender === peerId ? 'You' : msg.sender}
            </div>
            <div className={`message ${msg.sender === peerId ? 'message-self' : 'message-other'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
        />
        <button
          className="send-button"
          onClick={handleSendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

Chat.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      text: PropTypes.string,
      sender: PropTypes.string,
    })
  ),
  inputText: PropTypes.string.isRequired,
  setInputText: PropTypes.func.isRequired,
  handleSendMessage: PropTypes.func.isRequired,
  peerId: PropTypes.string.isRequired,
};

Chat.defaultProps = {
  messages: [],
};

export default Chat;