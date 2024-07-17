import { useEffect, useRef, useState } from 'react';
import {
  AutoComplete,
  Input,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const tagInputStyle = {
  marginRight: 8,
  width: 78,
};

const tagPlusStyle = {
  background: 'inherit',
  borderStyle: 'dashed',
  cursor: 'pointer',
};

export function TagsInput({ existingTags = [], onChange, value }) {

  const [editInputIndex, setEditInputIndex] = useState(-1);
  const [editInputValue, setEditInputValue] = useState(null);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [tags, setTags] = useState([]);

  const inputRef = useRef(null);
  const editInputRef = useRef(null);

  useEffect(() => {
    setTags(value || []);
  }, [value]);

  useEffect(() => {
    if (inputVisible) {
      inputRef.current?.focus();
    }
  }, [inputVisible]);

  useEffect(() => {
    editInputRef.current?.focus();
  }, [inputValue]);

  const handleAutocompleteChange = (value) => {
    setInputValue(value);
  };

  const handleClose = (removedTag) => {
    const newTags = tags.filter(t => t !== removedTag);
    setTags(newTags);
    if (typeof onChange === 'function') {
      onChange(newTags);
    }
  };

  const handleEditInputChange = (ev) => {
    setEditInputValue(ev.target.value);
  };

  const handleEditInputConfirm = () => {
    if (inputValue && tags.indexOf(inputValue) === -1) {
      const newTags = [...tags];
      newTags[editInputIndex] = editInputValue;
      setTags(newTags);
      if (typeof onChange === 'function') {
        onChange(newTags);
      }
    }
    setEditInputIndex(-1);
    setInputValue('');
  };

  const handleInputConfirm = () => {
    if (inputValue && tags.indexOf(inputValue) === -1) {
      const newTags = [...tags, inputValue];
      setTags(newTags);
      if (typeof onChange === 'function') {
        onChange(newTags);
      }
    }
    setInputVisible(false);
    setInputValue('');
  };

  const onSelect = (data) => {
    // console.log('onSelect', data);
  };

  const search = (text) => {
    return existingTags
      .filter(t => t.startsWith(text))
      .filter(t => tags.indexOf(t) === -1)
      .map((value) => ({ value }))
      ;
  };

  const showInput = () => {
    setInputVisible(true);
  };

  return (
    <Space size={[0, 8]} wrap>
      <Space size={[0, 8]} wrap>
        {tags.map((tag, index) => {
          if (editInputIndex === index) {
            return (
              <Input
                ref={editInputRef}
                key={tag}
                size="small"
                style={tagInputStyle}
                value={editInputValue}
                onChange={handleEditInputChange}
                onBlur={handleEditInputConfirm}
                onPressEnter={handleEditInputConfirm}
              />
            );
          }
          const isLongTag = tag.length > 20;
          const tagElem = (
            <Tag
              key={tag}
              closable={true}
              style={{
                userSelect: 'none',
              }}
              onClose={() => handleClose(tag)}
            >
              <span
                onDoubleClick={(e) => {
                  setEditInputIndex(index);
                  setEditInputValue(tag);
                  e.preventDefault();
                }}
              >
                {isLongTag ? `${tag.slice(0, 20)}...` : tag}
              </span>
            </Tag>
          );
          return isLongTag ? (
            <Tooltip title={tag} key={tag}>
              {tagElem}
            </Tooltip>
          ) : (
            tagElem
          );
        })}
      </Space>
      {inputVisible ? (
        <AutoComplete
          options={options}
          onSelect={onSelect}
          onSearch={(text) => setOptions(search(text))}
          value={inputValue}
          onChange={(value) => handleAutocompleteChange(value)}
          onBlur={() => handleInputConfirm()}
          style={{ height: 24 }}
        >
          <Input
            ref={inputRef}
            type="text"
            size="small"
            style={tagInputStyle}
            onPressEnter={() => handleInputConfirm()}
          />
        </AutoComplete>
      ) : (
        <Tag style={tagPlusStyle} onClick={() => showInput()}>
          <PlusOutlined /> New Tag
        </Tag>
      )}
    </Space>
  );
}